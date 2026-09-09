"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buyOrderShippingLabel,
  quoteOrderShipping,
  refundOrder,
  saveOrderTracking,
} from "@/app/admin/actions";
import type { Order } from "@/lib/types";
import { isOrderReturned } from "@/lib/types";

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
  const [rates, setRates] = useState<{ code: string; name: string; amount: string }[]>([]);
  const [refundedLocal, setRefundedLocal] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message: string; labelUrl?: string; rates?: { code: string; name: string; amount: string }[] }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        if (result.rates) setRates(result.rates);
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
  const shipped = order.status === "shipped" || Boolean(order.tracking_number);

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
              {order.refunded_amount != null ? `$${Number(order.refunded_amount).toFixed(2)}` : ""}
              {order.refunded_at
                ? ` on ${new Date(order.refunded_at).toLocaleDateString()}`
                : " This card has already been refunded."}
            </p>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !order.heartland_transaction_id}
            onClick={() => {
              if (
                !confirm(
                  "Refund this card? Heartland inventory will update automatically."
                )
              ) {
                return;
              }
              run(() => refundOrder(order.id));
            }}
            className="rounded-none tracking-[0.12em] uppercase text-xs"
          >
            Refund card
          </Button>
        )}
      </div>

      <div>
        <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
          Fulfillment
        </h3>
        <div className="space-y-2 max-h-[min(32rem,70vh)] overflow-y-auto pr-1">
          {shipped ? (
            <div className="space-y-1">
              <p className="text-sm font-mono break-all">
                {order.tracking_number ?? tracking}
              </p>
              {order.tracking_carrier || carrier ? (
                <p className="text-xs text-muted-foreground">
                  {order.tracking_carrier || carrier}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {labelsEnabled ? (
                <>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => quoteOrderShipping(order.id))}
                    className="rounded-none tracking-[0.12em] uppercase text-xs w-full"
                  >
                    Get UPS rates
                  </Button>
                  {rates.map((rate) => (
                    <Button
                      key={rate.code}
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !confirm(
                            `Print UPS ${rate.name} for $${rate.amount}? This bills the boutique UPS account and opens the label.`
                          )
                        ) {
                          return;
                        }
                        run(() => buyOrderShippingLabel(order.id, rate.code));
                      }}
                      className="rounded-none text-xs w-full justify-between"
                    >
                      <span>{rate.name}</span>
                      <span className="tabular-nums">${rate.amount}</span>
                    </Button>
                  ))}
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Add <code className="text-[10px]">UPS_CLIENT_ID</code>,{" "}
                  <code className="text-[10px]">UPS_CLIENT_SECRET</code>, and{" "}
                  <code className="text-[10px]">UPS_ACCOUNT_NUMBER</code> in Vercel. Create an
                  app at{" "}
                  <a
                    href="https://developer.ups.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    developer.ups.com
                  </a>{" "}
                  with Rating + Shipping, then you can quote and print labels here.
                </p>
              )}
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
          )}
        </div>
      </div>
    </div>
  );
}
