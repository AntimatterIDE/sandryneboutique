"use server";

import { revalidatePath } from "next/cache";
import { getSessionInfo } from "@/lib/auth";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { isOrderReturned, orderIsFinalSaleOnly, type Order } from "@/lib/types";

export async function requestOrderReturn(
  orderId: string
): Promise<{ ok: boolean; message: string }> {
  const { user } = await getSessionInfo();
  if (!user) return { ok: false, message: "Please sign in to request a return." };

  const supabase = await createPrivilegedClient();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (error || !order) return { ok: false, message: "Order not found." };

  const belongsToUser =
    order.user_id === user.id ||
    (typeof order.email === "string" &&
      user.email &&
      order.email.toLowerCase() === user.email.toLowerCase());
  if (!belongsToUser) return { ok: false, message: "You can only return your own orders." };

  if (isOrderReturned(order)) {
    return { ok: false, message: "This order was already refunded." };
  }
  if (order.status === "cancelled") {
    return { ok: false, message: "Cancelled orders cannot be returned." };
  }
  if (order.return_requested_at) {
    return { ok: false, message: "A return is already in progress for this order." };
  }
  if (order.status !== "paid" && order.status !== "shipped") {
    return { ok: false, message: "This order is not eligible for a return yet." };
  }
  if (orderIsFinalSaleOnly(order as Order)) {
    return { ok: false, message: "Sale items are final sale and cannot be returned." };
  }

  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("orders")
    .update({ return_requested_at: requestedAt })
    .eq("id", orderId);
  if (updateError) {
    return {
      ok: false,
      message:
        "Could not save the return request. Run supabase/migrations/015_order_returns.sql in Supabase.",
    };
  }

  try {
    const { sendReturnRequestedEmails } = await import("@/lib/email");
    await sendReturnRequestedEmails({
      ...(order as Order),
      return_requested_at: requestedAt,
    });
  } catch (err) {
    console.error("Return request email failed:", err);
  }

  revalidatePath("/account");
  revalidatePath("/admin/orders");
  return {
    ok: true,
    message:
      "Return requested. Ship the item back (you pay postage). We refund the item price only after it arrives. Checkout shipping is not refunded.",
  };
}
