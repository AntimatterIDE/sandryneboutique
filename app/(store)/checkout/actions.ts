"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import { chargeCard, heartlandConfigured } from "@/lib/heartland";
import {
  heartlandRetailConfigured,
  syncPaidOrderToRetail,
} from "@/lib/heartland-retail";
import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { discountAmount, findDiscount } from "@/lib/discounts";
import type { OrderItem, Product, ProductVariant, ShippingAddress } from "@/lib/types";
import { effectivePrice } from "@/lib/types";

export interface CheckoutLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface CheckoutInput {
  token: string;
  shipping: ShippingAddress;
  lines: CheckoutLine[];
  discountCode?: string | null;
}

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

function validateShipping(s: ShippingAddress): string | null {
  if (!s.full_name?.trim()) return "Please enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email ?? "")) return "Please enter a valid email.";
  if (!s.line1?.trim()) return "Please enter your street address.";
  if (!s.city?.trim()) return "Please enter your city.";
  if (!s.state?.trim()) return "Please enter your state.";
  if (!s.postal_code?.trim()) return "Please enter your postal code.";
  if (!s.country?.trim()) return "Please select your country.";
  return null;
}

export async function processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!heartlandConfigured()) {
    return { ok: false, error: "Payments are not configured yet. Add your Heartland keys to enable checkout." };
  }
  if (!supabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "The store database is not configured yet. Add your Supabase keys to enable checkout." };
  }

  if (!input.token) {
    return { ok: false, error: "Missing payment token. Please re-enter your card details." };
  }

  const shippingError = validateShipping(input.shipping);
  if (shippingError) return { ok: false, error: shippingError };

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      return { ok: false, error: "Invalid quantity in cart." };
    }
  }

  const admin = createAdminClient();

  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const variantIds = [
    ...new Set(input.lines.map((l) => l.variantId).filter((id): id is string => Boolean(id))),
  ];

  const { data: productRows, error: productError } = await admin
    .from("products")
    .select("*")
    .in("id", productIds);

  if (productError || !productRows) {
    console.error("Checkout product lookup failed:", productError);
    return { ok: false, error: "We couldn't verify your cart. Please try again." };
  }

  const products = new Map((productRows as Product[]).map((p) => [p.id, p]));

  const variants = new Map<string, ProductVariant>();
  if (variantIds.length > 0) {
    const { data: variantRows, error: variantError } = await admin
      .from("product_variants")
      .select("*")
      .in("id", variantIds);

    if (variantError) {
      console.error("Checkout variant lookup failed:", variantError);
      return { ok: false, error: "We couldn't verify your cart. Please try again." };
    }
    for (const row of (variantRows ?? []) as ProductVariant[]) {
      variants.set(row.id, row);
    }
  }

  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  for (const line of input.lines) {
    const product = products.get(line.productId);
    if (!product) {
      return { ok: false, error: "An item in your cart is no longer available." };
    }

    const variant = line.variantId ? variants.get(line.variantId) : null;

    if (line.variantId) {
      if (!variant || variant.product_id !== product.id || !variant.active) {
        return {
          ok: false,
          error: `A selected size/color for "${product.name}" is no longer available.`,
        };
      }
      if (heartlandRetailConfigured() && !variant.heartland_item_id) {
        return {
          ok: false,
          error: `"${product.name}" is not linked to Heartland Retail inventory and cannot be purchased online.`,
        };
      }
      if (variant.inventory_count < line.quantity) {
        return {
          ok: false,
          error: `Sorry, we only have ${variant.inventory_count} of "${product.name}" (${[variant.size, variant.color].filter(Boolean).join(" / ")}) left.`,
        };
      }

      const price =
        product.on_sale && product.sale_price != null
          ? product.sale_price
          : Number(variant.price) || effectivePrice(product);
      subtotal += price * line.quantity;
      orderItems.push({
        product_id: product.id,
        variant_id: variant.id,
        heartland_item_id: variant.heartland_item_id,
        heartland_public_id: variant.heartland_public_id,
        name: product.name,
        slug: product.slug,
        image: product.images[0] ?? null,
        price,
        quantity: line.quantity,
        size: variant.size ?? line.size,
        color: variant.color ?? line.color,
      });
      continue;
    }

    // Legacy product-level checkout when no variants exist yet.
    if (heartlandRetailConfigured() && product.heartland_item_id == null) {
      return {
        ok: false,
        error: `"${product.name}" is not linked to Heartland Retail inventory and cannot be purchased online.`,
      };
    }
    if (product.inventory_count < line.quantity) {
      return {
        ok: false,
        error: `Sorry, we only have ${product.inventory_count} of "${product.name}" left.`,
      };
    }
    const price = effectivePrice(product);
    subtotal += price * line.quantity;
    orderItems.push({
      product_id: product.id,
      variant_id: null,
      heartland_item_id: product.heartland_item_id,
      heartland_public_id: product.heartland_public_id,
      name: product.name,
      slug: product.slug,
      image: product.images[0] ?? null,
      price,
      quantity: line.quantity,
      size: line.size,
      color: line.color,
    });
  }

  let discount = 0;
  if (input.discountCode?.trim()) {
    const def = findDiscount(input.discountCode);
    if (!def) {
      return { ok: false, error: "That discount code isn't valid." };
    }
    discount = discountAmount(subtotal, def);
  }

  const discountedSubtotal = Math.max(0, subtotal - discount);
  const shippingCost = discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
  const total = Math.round((discountedSubtotal + shippingCost) * 100) / 100;

  const charge = await chargeCard({
    token: input.token,
    amount: total,
    postalCode: input.shipping.postal_code,
    streetAddress: input.shipping.line1,
  });

  if (!charge.ok) {
    return { ok: false, error: charge.message ?? "Payment failed. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: user?.id ?? null,
      email: input.shipping.email,
      total_amount: total,
      status: "paid",
      heartland_transaction_id: charge.transactionId,
      heartland_sync_status: heartlandRetailConfigured() ? "pending" : null,
      shipping_address: input.shipping,
      items: orderItems,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error(
      `CRITICAL: payment ${charge.transactionId} succeeded but order insert failed:`,
      orderError
    );
    return {
      ok: false,
      error:
        "Your payment was received but we hit a problem saving your order. Please contact us with your email address — do not retry.",
    };
  }

  for (const item of orderItems) {
    if (item.variant_id) {
      const { error: invError } = await admin.rpc("decrement_variant_inventory", {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity,
      });
      if (invError) {
        console.error(`Variant inventory decrement failed for ${item.variant_id}:`, invError);
      }
    } else {
      const { error: invError } = await admin.rpc("decrement_inventory", {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
      if (invError) {
        console.error(`Inventory decrement failed for ${item.product_id}:`, invError);
      }
    }
  }

  if (heartlandRetailConfigured()) {
    try {
      const retailLines = orderItems.map((item) => {
        const heartlandItemId = item.heartland_item_id;
        if (heartlandItemId == null) {
          throw new Error(`Missing Heartland item id for ${item.name}`);
        }
        return {
          heartlandItemId,
          quantity: item.quantity,
          unitPrice: item.price,
        };
      });

      const retail = await syncPaidOrderToRetail({
        email: input.shipping.email,
        fullName: input.shipping.full_name,
        shipping: {
          line1: input.shipping.line1,
          line2: input.shipping.line2,
          city: input.shipping.city,
          state: input.shipping.state,
          postal_code: input.shipping.postal_code,
          country: input.shipping.country,
        },
        lines: retailLines,
        shippingCharge: shippingCost,
        totalAmount: total,
        porticoTransactionId: charge.transactionId,
      });

      await admin
        .from("orders")
        .update({
          heartland_sales_order_id: retail.salesOrderId,
          heartland_sync_status: "synced",
        })
        .eq("id", order.id);
    } catch (err) {
      console.error(
        `CRITICAL: order ${order.id} paid (${charge.transactionId}) but Heartland Retail sync failed:`,
        err
      );
      await admin
        .from("orders")
        .update({ heartland_sync_status: "failed" })
        .eq("id", order.id);
    }
  }

  return { ok: true, orderId: order.id };
}
