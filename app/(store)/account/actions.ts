"use server";

import { revalidatePath } from "next/cache";
import { getSessionInfo } from "@/lib/auth";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { isOrderReturned, orderIsFinalSaleOnly, type Order } from "@/lib/types";

async function loadReturnableOrder(
  orderId: string
): Promise<{ ok: true; order: Order } | { ok: false; message: string }> {
  const { user } = await getSessionInfo();
  if (!user) return { ok: false, message: "Please sign in to request a return or exchange." };

  const supabase = await createPrivilegedClient();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (error || !order) return { ok: false, message: "Order not found." };

  const belongsToUser =
    order.user_id === user.id ||
    (typeof order.email === "string" &&
      user.email &&
      order.email.toLowerCase() === user.email.toLowerCase());
  if (!belongsToUser) return { ok: false, message: "You can only return or exchange your own orders." };

  if (isOrderReturned(order)) {
    return { ok: false, message: "This order was already refunded." };
  }
  if (order.status === "cancelled") {
    return { ok: false, message: "Cancelled orders cannot be returned or exchanged." };
  }
  if (order.return_requested_at) {
    return { ok: false, message: "A return or exchange is already in progress for this order." };
  }
  if (order.status !== "paid" && order.status !== "fulfilled" && order.status !== "shipped") {
    return { ok: false, message: "This order is not eligible yet." };
  }
  if (orderIsFinalSaleOnly(order as Order)) {
    return { ok: false, message: "Sale items are final sale and cannot be returned or exchanged." };
  }

  return { ok: true, order: order as Order };
}

export async function requestOrderReturn(
  orderId: string
): Promise<{ ok: boolean; message: string }> {
  const loaded = await loadReturnableOrder(orderId);
  if (!loaded.ok) return loaded;

  const supabase = await createPrivilegedClient();
  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("orders")
    .update({ return_requested_at: requestedAt, return_note: null })
    .eq("id", orderId);
  if (updateError) {
    const missingNote = /return_note/i.test(updateError.message ?? "");
    if (!missingNote) {
      return {
        ok: false,
        message:
          "Could not save the return request. Run supabase/migrations/015_order_returns.sql in Supabase.",
      };
    }
    const retry = await supabase
      .from("orders")
      .update({ return_requested_at: requestedAt })
      .eq("id", orderId);
    if (retry.error) {
      return { ok: false, message: "Could not save the return request." };
    }
  }

  try {
    const { sendReturnRequestedEmails } = await import("@/lib/email");
    await sendReturnRequestedEmails({
      ...loaded.order,
      return_requested_at: requestedAt,
      return_note: null,
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

export async function requestOrderExchange(
  orderId: string,
  note: string
): Promise<{ ok: boolean; message: string }> {
  const wanted = note.trim().replace(/\s+/g, " ");
  if (wanted.length < 3) {
    return { ok: false, message: "Tell us the size, color, or item you want instead." };
  }
  if (wanted.length > 400) {
    return { ok: false, message: "Please keep the exchange note under 400 characters." };
  }

  const loaded = await loadReturnableOrder(orderId);
  if (!loaded.ok) return loaded;

  const supabase = await createPrivilegedClient();
  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("orders")
    .update({ return_requested_at: requestedAt, return_note: wanted })
    .eq("id", orderId);
  if (updateError) {
    const missingNote = /return_note/i.test(`${updateError.message ?? ""} ${updateError.details ?? ""}`);
    if (!missingNote) {
      return { ok: false, message: "Could not save the exchange request." };
    }
    const retry = await supabase
      .from("orders")
      .update({ return_requested_at: requestedAt })
      .eq("id", orderId);
    if (retry.error) {
      return { ok: false, message: "Could not save the exchange request." };
    }
  }

  try {
    const { sendExchangeRequestedEmails } = await import("@/lib/email");
    await sendExchangeRequestedEmails(
      { ...loaded.order, return_requested_at: requestedAt, return_note: wanted },
      wanted
    );
  } catch (err) {
    console.error("Exchange request email failed:", err);
  }

  revalidatePath("/account");
  revalidatePath("/admin/orders");
  return {
    ok: true,
    message:
      "Exchange requested. Ship the original item back (you pay postage). We send the replacement after it arrives.",
  };
}
