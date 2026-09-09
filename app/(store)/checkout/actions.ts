"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import {
  chargeCard,
  heartlandConfigured,
  heartlandIsCertMode,
  heartlandKeyMismatchMessage,
} from "@/lib/heartland";
import {
  heartlandRetailConfigured,
  syncPaidOrderToRetail,
} from "@/lib/heartland-retail";
import { consumeCheckoutAttempt, getClientIp } from "@/lib/checkout-velocity";
import { hcaptchaConfigured, verifyHCaptcha } from "@/lib/hcaptcha";
import { checkoutTotals, isAddressQuotable, shippingForSubtotal } from "@/lib/tax";
import { FLAT_SHIPPING_RATE } from "@/lib/constants";
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

export interface CheckoutBilling {
  line1: string;
  postal_code: string;
}

export interface CheckoutInput {
  token: string;
  shipping: ShippingAddress;
  billing?: CheckoutBilling | null;
  lines: CheckoutLine[];
  discountCode?: string | null;
  captchaToken?: string | null;
  shippingServiceCode?: string | null;
}

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export type CheckoutShippingOption = {
  amount: number;
  service: string;
  code: string;
};

export type CheckoutShippingQuote =
  | { ok: true; rates: CheckoutShippingOption[] }
  | { ok: false; error: string };

export async function quoteCheckoutShipping(shipping: ShippingAddress): Promise<CheckoutShippingQuote> {
  if (!isAddressQuotable(shipping)) {
    return { ok: false, error: "Enter a complete shipping address to calculate shipping." };
  }

  const { shippingLabelsConfigured, quoteCheckoutShippingOptions } = await import("@/lib/shipping-label");
  if (!shippingLabelsConfigured()) {
    return { ok: true, rates: [{ amount: FLAT_SHIPPING_RATE, service: "Standard", code: "flat" }] };
  }

  try {
    const options = await quoteCheckoutShippingOptions(shipping);
    if (options.length === 0) {
      return { ok: false, error: "Could not calculate shipping for this address." };
    }
    return {
      ok: true,
      rates: options.map((option) => ({
        amount: option.amount,
        service: option.name,
        code: option.code,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not calculate shipping for this address.",
    };
  }
}

async function resolveCheckoutShipping(
  shipping: ShippingAddress,
  discountedSubtotal: number,
  serviceCode?: string | null
): Promise<{ amount: number; service: string; code: string }> {
  const fallback = shippingForSubtotal(discountedSubtotal);
  const { shippingLabelsConfigured, quoteCheckoutShippingOptions, isFreeEligibleUpsService } =
    await import("@/lib/shipping-label");

  if (!shippingLabelsConfigured()) {
    const code = serviceCode?.trim() || "flat";
    return { amount: fallback, service: fallback === 0 ? "Free" : "Standard", code };
  }

  try {
    const options = await quoteCheckoutShippingOptions(shipping);
    const selected =
      options.find((option) => option.code === serviceCode) ??
      options.find((option) => option.code === "03") ??
      options[0];
    if (!selected) {
      return { amount: fallback, service: fallback === 0 ? "Free" : "Standard", code: "flat" };
    }
    const freeEligible = fallback === 0 && isFreeEligibleUpsService(selected.code);
    return {
      amount: freeEligible ? 0 : selected.amount,
      service: freeEligible ? `${selected.name} (Free)` : selected.name,
      code: selected.code,
    };
  } catch (err) {
    console.warn("Checkout UPS quote failed; using standard shipping:", err);
    return { amount: fallback, service: fallback === 0 ? "Free" : "Standard", code: "flat" };
  }
}

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
  const keyMismatch = heartlandKeyMismatchMessage();
  if (keyMismatch) {
    return { ok: false, error: keyMismatch };
  }
  if (heartlandIsCertMode()) {
    return {
      ok: false,
      error:
        "This site is still using Heartland sandbox (cert) keys. A live card cannot be charged until both keys are pkapi_prod_ / skapi_prod_ and the site is redeployed.",
    };
  }
  if (!supabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "The store database is not configured yet. Add your Supabase keys to enable checkout." };
  }

  if (!input.token) {
    return { ok: false, error: "Missing payment token. Please re-enter your card details." };
  }

  const headerList = await headers();
  const ip = getClientIp(headerList);
  const velocity = consumeCheckoutAttempt(ip);
  if (!velocity.ok) {
    return {
      ok: false,
      error: `Too many checkout attempts. Please wait ${velocity.retryAfterSec} seconds and try again.`,
    };
  }

  if (hcaptchaConfigured()) {
    const captcha = await verifyHCaptcha(input.captchaToken ?? undefined, ip);
    if (!captcha.ok) {
      return { ok: false, error: captcha.error };
    }
  }

  const shippingError = validateShipping(input.shipping);
  if (shippingError) return { ok: false, error: shippingError };
  if (input.billing) {
    if (!input.billing.line1?.trim()) return { ok: false, error: "Please enter the billing street address on your card." };
    if (!input.billing.postal_code?.trim()) return { ok: false, error: "Please enter the billing ZIP on your card." };
  }

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

  const discountedSubtotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const shippingQuote = await resolveCheckoutShipping(
    input.shipping,
    discountedSubtotal,
    input.shippingServiceCode
  );
  const shippingCost = shippingQuote.amount;
  const { tax, total } = checkoutTotals({
    subtotal,
    discount,
    state: input.shipping.state,
    postalCode: input.shipping.postal_code,
    shippingAmount: shippingCost,
  });

  const billingStreet = input.billing?.line1?.trim() || input.shipping.line1;
  const billingPostal = input.billing?.postal_code?.trim() || input.shipping.postal_code;

  const charge = await chargeCard({
    token: input.token,
    amount: total,
    postalCode: billingPostal,
    streetAddress: billingStreet,
    country: input.shipping.country,
  });

  if (!charge.ok) {
    console.error("Portico charge declined:", {
      responseCode: charge.responseCode,
      avsResponseCode: charge.avsResponseCode,
      cvnResponseCode: charge.cvnResponseCode,
    });
    return { ok: false, error: charge.message ?? "Payment failed. Please try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const orderPayload = {
    user_id: user?.id ?? null,
    email: input.shipping.email,
    total_amount: total,
    status: "paid" as const,
    heartland_transaction_id: charge.transactionId,
    heartland_sync_status: heartlandRetailConfigured() ? "pending" : null,
    tax_amount: tax,
    shipping_amount: shippingCost,
    shipping_service: shippingQuote.service,
    shipping_service_code: shippingQuote.code,
    shipping_address: input.shipping,
    items: orderItems,
  };

  let { data: order, error: orderError } = await admin
    .from("orders")
    .insert(orderPayload)
    .select("id")
    .single();

  if (orderError) {
    const {
      tax_amount: _tax,
      shipping_amount: _ship,
      shipping_service: _svc,
      shipping_service_code: _code,
      ...legacyPayload
    } = orderPayload;
    void _svc;
    void _code;
    void _tax;
    void _ship;
    const retry = await admin.from("orders").insert(legacyPayload).select("id").single();
    order = retry.data;
    orderError = retry.error;
  }

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
        persistSalesOrderId: async (id) => {
          await admin.from("orders").update({ heartland_sales_order_id: id }).eq("id", order.id);
        },
      });

      await admin
        .from("orders")
        .update({
          heartland_sales_order_id: retail.salesOrderId,
          heartland_sync_status: "synced",
          heartland_sync_error: null,
        })
        .eq("id", order.id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Retail sync failed.";
      const { salesOrderIdFromRetailError } = await import("@/lib/heartland-retail");
      const createdId = salesOrderIdFromRetailError(detail);
      console.error(
        `CRITICAL: order ${order.id} paid (${charge.transactionId}) but Heartland Retail sync failed:`,
        err
      );
      await admin
        .from("orders")
        .update({
          ...(createdId ? { heartland_sales_order_id: createdId } : {}),
          heartland_sync_status: "failed",
          heartland_sync_error: detail.slice(0, 1000),
        })
        .eq("id", order.id);
    }
  }

  revalidatePath("/shop");
  revalidatePath("/admin/orders");
  for (const item of orderItems) {
    if (item.slug) revalidatePath(`/products/${item.slug}`);
  }

  return { ok: true, orderId: order.id };
}
