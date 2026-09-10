import { isFedExServiceCode } from "@/lib/shipping-services";
import type { Order } from "@/lib/types";

export function orderTrackingUrl(order: Pick<Order, "tracking_number" | "tracking_carrier" | "shipping_service_code">): string | null {
  const tracking = order.tracking_number?.trim();
  if (!tracking) return null;
  const carrier = `${order.tracking_carrier ?? ""} ${order.shipping_service_code ?? ""}`;
  if (/fedex/i.test(carrier) || isFedExServiceCode(order.shipping_service_code)) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(tracking)}`;
  }
  return `https://www.ups.com/track?tracknum=${encodeURIComponent(tracking)}`;
}
