"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buyOrderShippingLabel,
  markReturnReceived,
  refundOrder,
  retryRetailSync,
  saveOrderTracking,
} from "@/app/admin/actions";
import { carrierAccountUrl, paidShippingCarrier, type PaidShippingCarrier } from "@/lib/shipping-services";
import { STORE_CONTACT } from "@/lib/constants";
import type { Order, ShippingAddress } from "@/lib/types";
import {
  formatPrice,
  isOrderReturned,
  orderHasFinalSale,
  orderIsFinalSaleOnly,
  orderRefundBreakdown,
} from "@/lib/types";

function openShippingLabel(labelUrl: string) {
  const match = labelUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) {
    window.open(labelUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: match[1] }));
  window.open(blobUrl, "_blank", "noopener,noreferrer");
}

function shipToText(address: ShippingAddress): string {
  return [
    address.full_name,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function AccountLink({ carrier, hasTracking }: { carrier: PaidShippingCarrier; hasTracking: boolean }) {
  const href = carrierAccountUrl(carrier, hasTracking);
  const label = hasTracking
    ? `Open ${carrier} and print this label`
    : `Open ${carrier} and make the label`;
  return (
    <Button asChild className="rounded-none tracking-[0.12em] uppercase text-xs w-full h-auto py-3 whitespace-normal">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </Button>
  );
}

function LabelPrintHelp({
  carrier,
  serviceName,
  trackingNumber,
  heartlandSalesOrderId,
  orderRef,
  address,
  onCopy,
}: {
  carrier: PaidShippingCarrier | null;
  serviceName: string;
  trackingNumber?: string | null;
  heartlandSalesOrderId?: number | null;
  orderRef: string;
  address: ShippingAddress;
  onCopy: (value: string) => void;
}) {
  const tracking = trackingNumber?.trim() || "";
  const addressText = shipToText(address);
  const fromText = `Sandryne Boutique\n${STORE_CONTACT.addressLines.join("\n")}`;
  const heartlandNumber = heartlandSalesOrderId != null ? String(heartlandSalesOrderId) : null;

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{serviceName || (carrier ? carrier : "UPS or FedEx")}</p>
      {carrier ? (
        <AccountLink carrier={carrier} hasTracking={Boolean(tracking)} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Open the email for this order. It says UPS or FedEx. Click that button. Do not click both.
          </p>
          <AccountLink carrier="UPS" hasTracking={Boolean(tracking)} />
          <AccountLink carrier="FedEx" hasTracking={Boolean(tracking)} />
        </div>
      )}

      {tracking ? (
        <div className="border border-foreground/15 p-3 space-y-2">
          <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">Type this number</p>
          <p className="font-mono text-base break-all">{tracking}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onCopy(tracking)}
            className="rounded-none tracking-[0.12em] uppercase text-xs"
          >
            Copy tracking number
          </Button>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Log in. Open the list of shipments. Paste this number. Print that label.
            {carrier === "FedEx" ? " On FedEx, the list is called Ship History." : " On UPS, the page is Shipping History."}
          </p>
        </div>
      ) : (
        <div className="border border-foreground/15 p-3 space-y-2">
          <p className="font-medium">There is no number to search yet.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This package is not in UPS or FedEx until you make the label. Do not search. Log in, start a new shipment, and paste the address.
          </p>
          <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">Ship to</p>
          <p className="whitespace-pre-line text-xs">{addressText}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onCopy(addressText)}
            className="rounded-none tracking-[0.12em] uppercase text-xs"
          >
            Copy ship-to address
          </Button>
          <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground">Ship from</p>
          <p className="whitespace-pre-line text-xs">{fromText}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onCopy(fromText)}
            className="rounded-none tracking-[0.12em] uppercase text-xs"
          >
            Copy ship-from address
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
        <p>Do not type these. UPS and FedEx do not know them.</p>
        {heartlandNumber ? <p className="font-mono text-foreground/80">Heartland {heartlandNumber}</p> : null}
        <p className="font-mono break-all text-foreground/80">Order {orderRef}</p>
      </div>
    </div>
  );
}

export function OrderTools({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const serviceName = order.shipping_service?.trim() || "";
  const serviceCode = order.shipping_service_code?.trim() || "";
  const paidCarrier = paidShippingCarrier(serviceName, serviceCode);
  const [tracking, setTracking] = useState(order.tracking_number ?? "");
  const [carrier, setCarrier] = useState(order.tracking_carrier ?? paidCarrier ?? "");
  const [refundedLocal, setRefundedLocal] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; message: string; labelUrl?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        if (result.labelUrl) openShippingLabel(result.labelUrl);
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
  const fullRefund = orderRefundBreakdown(order, { includeFinalSale: true });
  const saleOnly = orderIsFinalSaleOnly(order);
  const hasSale = orderHasFinalSale(order);
  const returnRequested = Boolean(order.return_requested_at);
  const returnReceived = Boolean(order.return_received_at);
  const shippedOrder = order.status === "shipped" || Boolean(order.tracking_number);
  const waitForReturn = shippedOrder && returnRequested && !returnReceived;
  const hasLabel = Boolean(order.shipping_label_url);
  const hasTracking = Boolean(order.tracking_number);
  const shipped = order.status === "shipped" || hasTracking;

  const printLabel = () => {
    if (hasLabel && order.shipping_label_url) {
      openShippingLabel(order.shipping_label_url);
      return;
    }
    if (!serviceCode || serviceCode === "flat" || !paidCarrier) {
      toast.error(
        "This order has no saved UPS or FedEx service. Check the confirmation email, buy that carrier’s label, then enter the tracking number below. Do not assume UPS."
      );
      return;
    }
    if (
      !confirm(
        `Print ${serviceName || paidCarrier} label? This bills the boutique ${paidCarrier} account and opens the label. The customer already paid shipping at checkout.`
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
                ? ` Item price only — checkout shipping was not refunded.`
                : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {returnRequested ? (
              <p className="text-xs text-muted-foreground">
                Customer requested a return
                {order.return_requested_at
                  ? ` on ${new Date(order.return_requested_at).toLocaleDateString()}`
                  : ""}
                . They pay to ship it back. Refund the item price only.
              </p>
            ) : null}
            {returnRequested && !returnReceived ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      "Mark this return received? Heartland will record the return on the sales order and put the item back in available inventory. Then refund the item price only — not shipping."
                    )
                  ) {
                    return;
                  }
                  run(() => markReturnReceived(order.id));
                }}
                className="rounded-none tracking-[0.12em] uppercase text-xs"
              >
                Mark return received
              </Button>
            ) : null}
            {returnReceived ? (
              <p className="text-xs text-muted-foreground">Item received — refund the card.</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={
                pending ||
                !order.heartland_transaction_id ||
                (money.refundable <= 0 && !saleOnly) ||
                (saleOnly && fullRefund.refundable <= 0) ||
                waitForReturn
              }
              onClick={() => {
                const amount = money.refundable > 0 ? money.refundable : fullRefund.refundable;
                const overrideSale = money.refundable <= 0 && saleOnly;
                const saleNote = hasSale
                  ? overrideSale
                    ? " This order is final sale. Refund anyway?"
                    : " Sale items stay charged."
                  : "";
                if (
                  !confirm(
                    `Refund ${formatPrice(amount)} — the item price only? Checkout shipping is not refunded. The customer pays to ship the item back.${saleNote}`
                  )
                ) {
                  return;
                }
                run(() => refundOrder(order.id, { includeFinalSale: overrideSale }));
              }}
              className="rounded-none tracking-[0.12em] uppercase text-xs"
            >
              {money.refundable > 0
                ? `Refund ${formatPrice(money.refundable)}`
                : saleOnly
                  ? `Refund anyway ${formatPrice(fullRefund.refundable)}`
                  : `Refund ${formatPrice(money.refundable)}`}
            </Button>
            {waitForReturn ? (
              <p className="text-xs text-muted-foreground">
                Wait until the return arrives, then mark it received before refunding.
              </p>
            ) : saleOnly ? (
              <p className="text-xs text-muted-foreground">
                Sale items are final sale. Customer returns are blocked.
              </p>
            ) : money.shippingKept > 0 ? (
              <p className="text-xs text-muted-foreground">
                Refund the item price only. Checkout shipping is not refunded.
                {hasSale ? " Sale items stay charged." : ""}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {!order.heartland_sales_order_id && order.status !== "cancelled" && !refunded ? (
        <div>
          <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
            Heartland
          </h3>
          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
            This paid order is not on the Heartland Sales Orders page yet. Sending it does not charge the card again.
          </p>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !confirm(
                  "Create the Heartland sales order for this website sale? The card is already charged. The order will show under Sales → Sales Orders."
                )
              ) {
                return;
              }
              run(() => retryRetailSync(order.id));
            }}
            className="rounded-none tracking-[0.12em] uppercase text-xs w-full"
          >
            Send to Heartland
          </Button>
        </div>
      ) : null}

      <div>
        <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
          Shipping
        </h3>
        <div className="space-y-2 max-h-[min(32rem,70vh)] overflow-y-auto pr-1">
          <LabelPrintHelp
            carrier={paidCarrier}
            serviceName={serviceName}
            trackingNumber={order.tracking_number}
            heartlandSalesOrderId={order.heartland_sales_order_id}
            orderRef={order.id}
            address={order.shipping_address}
            onCopy={(value) => {
              void navigator.clipboard.writeText(value);
              toast.success("Copied. Paste it on the UPS or FedEx page.");
            }}
          />

          {hasLabel && !refunded ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={printLabel}
              className="rounded-none tracking-[0.12em] uppercase text-xs w-full"
            >
              Or open the label already saved here
            </Button>
          ) : null}

          {!shipped && !refunded ? (
            <>
              <p className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground pt-2">
                Or enter tracking
              </p>
              <Input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="UPS or FedEx"
                aria-label="Carrier — type UPS or FedEx"
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
