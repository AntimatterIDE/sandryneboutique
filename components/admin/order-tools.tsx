"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buyOrderShippingLabel, refundOrder, saveOrderTracking } from "@/app/admin/actions";
import type { Order } from "@/lib/types";
import { formatPrice, isOrderReturned, orderRefundBreakdown } from "@/lib/types";

export function OrderTools({
  order,
  labelsEnabled,
}: {
  order: Order;
  labelsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [carrier, setCarrier] = useState(order.tracking_carrier ?? "UPS");
  const [refundedLocal, setRefundedLocal] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message: string; labelUrl?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        if (result.labelUrl) window.open(result.labelUrl, "_blank", "noopener,noreferrer");
        if (result.message.toLowerCase().includes("refund")) setRefundedLocal(true);
      } else {
        toast.error(result.message);
        if (result.message.toLowerCase().includes("already refunded")) setRefundedLocal(true);
      }
      router.refresh();
    });
  };

  const refunded = refundedLocal || isOrderReturned(order) || order.status === "cancelled";
  const money = orderRefundBreakdown(order);
  const serviceName = order.shipping_service?.trim() || "UPS Ground";
  const serviceCode = order.shipping_service_code?.trim() || "03";
  const hasLabel = Boolean(order.shipping_label_url);
  const hasTracking = Boolean(order.tracking_number);
  const shipped = order.status === "shipped" || hasTracking;

  const printLabel = () => {
    if (hasLabel && order.shipping_label_url) {
      window.open(order.shipping_label_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (
      !confirm(
        `Print ${serviceName} label? This bills the boutique UPS account and opens the label. The customer already paid shipping at checkout.`
      )
    ) {
      return;
    }
    run(() => buyOrderShippingLabel(order.id, serviceCode));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
          Refund
        </h3>
        {refunded ? (
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              disabled
              className="rounded-none tracking-[0.12em] uppercase text-xs"
            >
              Refunded
            </Button>
            <p className="text-xs text-muted-foreground">
              {order.refunded_amount != null ? `${formatPrice(Number(order.refunded_amount))} refunded` : ""}
              {order.refunded_at
                ? ` on ${new Date(order.refunded_at).toLocaleDateString()}`
                : " This card has already been refunded."}
              {money.shippingKept > 0
                ? ` Shipping ${formatPrice(money.shippingKept)} was kept.`
                : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !order.heartland_transaction_id || money.refundable <= 0}
              onClick={() => {
                const keep =
                  money.shippingKept > 0
                    ? ` The customer still pays ${formatPrice(money.shippingKept)} shipping.`
                    : "";
                if (
                  !confirm(
                    `Refund ${formatPrice(money.refundable)} for merchandise and tax?${keep} Heartland inventory will update automatically.`
                  )
                ) {
                  return;
                }
                run(() => refundOrder(order.id));
              }}
              className="rounded-none tracking-[0.12em] uppercase text-xs"
            >
              Refund {formatPrice(money.refundable)}
            </Button>
            {money.shippingKept > 0 ? (
              <p className="text-xs text-muted-foreground">
                Shipping {formatPrice(money.shippingKept)} stays charged.
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
          Shipping
        </h3>
        <div className="space-y-2 max-h-[min(32rem,70vh)] overflow-y-auto pr-1">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{serviceName}</p>
            <p className="text-xs text-muted-foreground">
              {money.shipping === 0
                ? "Free shipping paid at checkout"
                : `${formatPrice(money.shipping)} paid at checkout`}
            </p>
            {hasTracking ? (
              <p className="text-sm font-mono break-all pt-1">
                {order.tracking_carrier || carrier ? `${order.tracking_carrier || carrier} · ` : ""}
                {order.tracking_number ?? tracking}
              </p>
            ) : null}
          </div>

          {labelsEnabled ? (
            (hasLabel || !refunded) && (
              <Button
                type="button"
                disabled={pending && !hasLabel}
                onClick={printLabel}
                className="rounded-none tracking-[0.12em] uppercase text-xs w-full"
              >
                {hasLabel ? "Print label" : `Print ${serviceName} label`}
              </Button>
            )
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Add <code className="text-[10px]">UPS_CLIENT_ID</code>,{" "}
              <code className="text-[10px]">UPS_CLIENT_SECRET</code>, and{" "}
              <code className="text-[10px]">UPS_ACCOUNT_NUMBER</code> in Vercel to print labels
              here.
            </p>
          )}

          {!shipped && !refunded ? (
            <>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground pt-2">
                Or enter tracking
              </p>
              <Input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="Carrier"
                aria-label="Carrier"
                className="rounded-none h-9 text-xs"
              />
              <Input
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Tracking number"
                aria-label="Tracking number"
                className="rounded-none h-9 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => saveOrderTracking(order.id, tracking, carrier))}
                className="rounded-none tracking-[0.12em] uppercase text-xs w-full"
              >
                Save tracking &amp; mark shipped
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
