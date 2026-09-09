import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  heartlandRetailConfigured,
  salesOrderIdFromRetailError,
  syncPaidOrderToRetail,
} from "@/lib/heartland-retail";

export async function syncWebsiteOrderToRetail(
  admin: SupabaseClient,
  order: {
    id: string;
    email: string;
    items: unknown;
    shipping_address: unknown;
    shipping_amount?: number | null;
    total_amount: number;
    heartland_transaction_id?: string | null;
    heartland_sales_order_id?: number | null;
    heartland_sync_error?: string | null;
    heartland_sync_status?: string | null;
    refunded_at?: string | null;
  }
): Promise<{ ok: true; salesOrderId: number } | { ok: false; error: string }> {
  if (!heartlandRetailConfigured()) {
    return { ok: false, error: "Heartland Retail is not fully configured." };
  }
  if (order.refunded_at) {
    return { ok: false, error: "Order was refunded." };
  }
  if (order.heartland_sync_status === "synced" && order.heartland_sales_order_id) {
    return { ok: true, salesOrderId: order.heartland_sales_order_id };
  }

  try {
    const items = (order.items ?? []) as {
      name: string;
      quantity: number;
      price: number;
      heartland_item_id?: number | null;
    }[];
    const lines = items.map((item) => {
      if (item.heartland_item_id == null) {
        throw new Error(`Missing Heartland item id for ${item.name}`);
      }
      return {
        heartlandItemId: item.heartland_item_id,
        quantity: item.quantity,
        unitPrice: Number(item.price),
      };
    });

    const shipping = order.shipping_address as {
      full_name: string;
      line1: string;
      line2?: string | null;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
    const billing = (order as { billing_address?: typeof shipping | null; tax_amount?: number | null })
      .billing_address;

    const retail = await syncPaidOrderToRetail({
      email: order.email,
      fullName: shipping.full_name,
      shipping,
      billing: billing
        ? {
            fullName: billing.full_name,
            line1: billing.line1,
            line2: billing.line2,
            city: billing.city,
            state: billing.state,
            postal_code: billing.postal_code,
            country: billing.country,
          }
        : null,
      lines,
      shippingCharge: Number(order.shipping_amount ?? 0),
      taxAmount: Number((order as { tax_amount?: number | null }).tax_amount ?? 0),
      totalAmount: Number(order.total_amount),
      porticoTransactionId: order.heartland_transaction_id ?? undefined,
      existingSalesOrderId:
        order.heartland_sales_order_id ??
        salesOrderIdFromRetailError(order.heartland_sync_error) ??
        undefined,
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

    return { ok: true, salesOrderId: retail.salesOrderId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Retail sync failed.";
    await admin
      .from("orders")
      .update({
        heartland_sync_status: "failed",
        heartland_sync_error: detail.slice(0, 1000),
      })
      .eq("id", order.id);
    return { ok: false, error: detail };
  }
}
