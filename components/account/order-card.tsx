"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requestOrderReturn } from "@/app/(store)/account/actions";
import type { Order } from "@/lib/types";
import {
  formatPrice,
  isFinalSaleItem,
  isOrderReturned,
  orderIsFinalSaleOnly,
  orderMoneyBreakdown,
  orderRefundBreakdown,
} from "@/lib/types";

function statusLabel(order: Order): string {
  if (isOrderReturned(order)) return "Refunded";
  if (order.return_received_at) return "Return received";
  if (order.return_requested_at) return "Return requested";
  if (order.status === "shipped") return "Shipped";
  if (order.status === "paid") return "Paid";
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "pending") return "Pending";
  return order.status;
}

export function AccountOrderCard({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const money = orderMoneyBreakdown(order);
  const refund = orderRefundBreakdown(order);
  const finalSaleOnly = orderIsFinalSaleOnly(order);
  const canRequestReturn =
    !isOrderReturned(order) &&
    !order.return_requested_at &&
    !finalSaleOnly &&
    (order.status === "paid" || order.status === "shipped");
  const trackingUrl = order.tracking_number
    ? `https://www.ups.com/track?tracknum=${encodeURIComponent(order.tracking_number)}`
    : null;

  return (
    <article className="border border-foreground/10 p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-[11px] text-muted-foreground/70 break-all mt-0.5">
            Ref: {order.id}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="rounded-none uppercase tracking-[0.14em] text-[10px]">
            {statusLabel(order)}
          </Badge>
          <span className="text-sm font-medium tabular-nums">{formatPrice(order.total_amount)}</span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {order.items.map((item, i) => (
          <li key={i} className="flex justify-between text-sm gap-4">
            <span className="text-muted-foreground min-w-0">
              {item.quantity} × {item.name}
              {(item.size || item.color) && (
                <span className="text-muted-foreground/70">
                  {" "}
                  ({[item.size, item.color].filter(Boolean).join(" · ")})
                </span>
              )}
              {isFinalSaleItem(item) ? (
                <span className="block text-[11px] tracking-[0.12em] uppercase text-destructive">
                  Final sale
                </span>
              ) : null}
            </span>
            <span className="tabular-nums shrink-0">{formatPrice(item.price * item.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between text-sm pt-2 border-t border-foreground/8">
          <span className="text-muted-foreground">
            Shipping{order.shipping_service ? ` · ${order.shipping_service}` : ""}
          </span>
          <span className="tabular-nums">{money.shipping === 0 ? "Free" : formatPrice(money.shipping)}</span>
        </li>
        <li className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span className="tabular-nums">{formatPrice(money.tax)}</span>
        </li>
      </ul>

      {order.status === "shipped" || order.tracking_number ? (
        <div className="text-sm">
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
            Shipping
          </p>
          <p>
            {order.tracking_carrier || "UPS"}
            {order.tracking_number ? ` · ${order.tracking_number}` : " · preparing tracking"}
          </p>
          {trackingUrl ? (
            <Link
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-2 mt-1 inline-block"
            >
              Track package
            </Link>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          We&apos;ll email tracking as soon as this order ships.
        </p>
      )}

      {isOrderReturned(order) ? (
        <p className="text-xs text-muted-foreground">
          Refunded {order.refunded_amount != null ? formatPrice(Number(order.refunded_amount)) : ""}
          {refund.shippingKept > 0 ? `. Shipping ${formatPrice(refund.shippingKept)} was kept.` : "."}
        </p>
      ) : order.return_requested_at ? (
        <p className="text-xs text-muted-foreground">
          Return requested
          {order.return_received_at
            ? " — we received your package and will refund your card (shipping not included)."
            : " — ship the item back with your order reference. You pay return postage. We refund merchandise and tax after it arrives."}
        </p>
      ) : finalSaleOnly && !isOrderReturned(order) ? (
        <p className="text-xs text-muted-foreground">
          This order is final sale and cannot be returned.
        </p>
      ) : canRequestReturn ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Request a return? You pay return shipping. Original shipping${refund.shippingKept > 0 ? ` (${formatPrice(refund.shippingKept)})` : ""} is not refunded. Sale items are final sale. We refund ${formatPrice(refund.refundable)} after returnable items arrive.`
              )
            ) {
              return;
            }
            startTransition(async () => {
              const result = await requestOrderReturn(order.id);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
              router.refresh();
            });
          }}
          className="rounded-none tracking-[0.12em] uppercase text-xs"
        >
          Request return
        </Button>
      ) : null}
    </article>
  );
}
