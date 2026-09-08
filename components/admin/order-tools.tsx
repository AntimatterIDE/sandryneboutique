"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buyOrderShippingLabel,
  refundOrder,
  retryRetailSync,
  saveOrderTracking,
} from "@/app/admin/actions";
import type { Order } from "@/lib/types";

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

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });
  };

  const refunded = Boolean(order.refunded_at);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
          Refund
        </h3>
        {refunded ? (
          <p className="text-xs text-muted-foreground">
            Refunded {order.refunded_amount != null ? `$${Number(order.refunded_amount).toFixed(2)}` : ""}{" "}
            {order.refunded_at ? `on ${new Date(order.refunded_at).toLocaleDateString()}` : ""}
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={pending || !order.heartland_transaction_id}
            onClick={() => {
              if (!confirm("Refund this charge back to the card in Heartland?")) return;
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
          Heartland Retail
        </h3>
        {order.heartland_sync_status === "failed" && order.heartland_sync_error ? (
          <p className="text-xs text-destructive mb-2 break-words">{order.heartland_sync_error}</p>
        ) : null}
        {order.heartland_sync_status !== "synced" ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => retryRetailSync(order.id))}
            className="rounded-none tracking-[0.12em] uppercase text-xs"
          >
            Retry inventory sync
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Synced. Stock should be reduced in Retail.</p>
        )}
      </div>

      <div>
        <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
          Fulfillment
        </h3>
        <div className="space-y-2">
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
          {labelsEnabled ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(() => buyOrderShippingLabel(order.id))}
              className="rounded-none tracking-[0.12em] uppercase text-xs w-full"
            >
              Buy UPS label
            </Button>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Add <code className="text-[10px]">EASYPOST_API_KEY</code> in Vercel to buy UPS
              labels here. Until then, create the label in UPS and paste the tracking number.
            </p>
          )}
          {order.shipping_label_url ? (
            <a
              href={order.shipping_label_url}
              target="_blank"
              rel="noreferrer"
              className="block text-xs underline underline-offset-2"
            >
              Open purchased label
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
