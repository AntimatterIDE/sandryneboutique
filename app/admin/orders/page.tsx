import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { OrderTools } from "@/components/admin/order-tools";
import { OrdersToolbar } from "@/components/admin/orders-toolbar";
import { shippingLabelsConfigured } from "@/lib/shipping-label";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import type { Order, OrderStatus } from "@/lib/types";
import { formatPrice, isOrderReturned, orderItemNumber, orderMoneyBreakdown } from "@/lib/types";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const activeFilter = (status as OrderStatus | undefined) ?? "all";
  const queryText = q?.trim().toLowerCase() ?? "";

  let orders: Order[] = [];
  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (activeFilter === "returned") {
      query = query.in("status", ["returned", "cancelled"]);
    } else if (activeFilter === "cancelled") {
      query = query.eq("status", "cancelled");
    } else if (activeFilter !== "all") {
      query = query.eq("status", activeFilter);
    }
    const { data } = await query;
    orders = (data ?? []) as Order[];

    if (activeFilter === "returned") {
      orders = orders.filter((order) => isOrderReturned(order));
    } else if (activeFilter === "cancelled") {
      orders = orders.filter((order) => !isOrderReturned(order));
    }

    if (queryText) {
      orders = orders.filter((order) => {
        const name = order.shipping_address.full_name.toLowerCase();
        const email = order.email.toLowerCase();
        const itemMatch = order.items.some((item) => {
          const itemNo = orderItemNumber(item)?.toLowerCase() ?? "";
          return item.name.toLowerCase().includes(queryText) || itemNo.includes(queryText);
        });
        return name.includes(queryText) || email.includes(queryText) || order.id.includes(queryText) || itemMatch;
      });
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {orders.length} {orders.length === 1 ? "order" : "orders"}
          {activeFilter !== "all" || queryText ? " matching filters" : ""}.
        </p>
      </header>

      <Suspense>
        <OrdersToolbar />
      </Suspense>

      {orders.length === 0 ? (
        <div className="py-16 sm:py-20 text-center border border-dashed border-foreground/15">
          <p className="font-serif text-2xl mb-2">No orders found</p>
          <p className="text-sm text-muted-foreground px-4">
            {activeFilter === "all" && !queryText
              ? "Orders will appear here as customers check out."
              : "Try a different status or search."}
          </p>
        </div>
      ) : (
        <Accordion
          type="multiple"
          className="border border-foreground/10 divide-y divide-foreground/8"
        >
          {orders.map((order) => {
            const money = orderMoneyBreakdown(order);
            return (
            <AccordionItem key={order.id} value={order.id} className="border-b-0 px-3 sm:px-5">
              <AccordionTrigger className="hover:no-underline py-4 items-start">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 pr-2 sm:pr-4 text-left w-full min-w-0">
                  <div className="min-w-0 sm:min-w-44">
                    <p className="text-sm font-medium truncate">
                      {order.shipping_address.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{order.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <Badge
                      variant="secondary"
                      className="rounded-none text-[10px] uppercase tracking-[0.14em]"
                    >
                      {isOrderReturned(order) ? "Returned" : order.status}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums sm:ml-auto">
                      {formatPrice(order.total_amount)}
                    </span>
                    {order.tracking_number ? (
                      <span className="text-[11px] font-mono text-muted-foreground break-all">
                        {order.tracking_carrier ? `${order.tracking_carrier} · ` : ""}
                        {order.tracking_number}
                      </span>
                    ) : null}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-8 overflow-visible">
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 min-w-0">
                    <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-3">
                      Items
                    </h3>
                    <ul className="space-y-2">
                      {order.items.map((item, i) => {
                        const itemNo = orderItemNumber(item);
                        return (
                        <li
                          key={i}
                          className="flex flex-col gap-0.5 xs:flex-row sm:flex-row sm:justify-between text-sm"
                        >
                          <span className="min-w-0">
                            {item.quantity} × {item.name}
                            {(item.size || item.color) && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({[item.size, item.color].filter(Boolean).join(" · ")})
                              </span>
                            )}
                            {itemNo ? (
                              <span className="block text-xs font-mono text-muted-foreground">
                                Item # {itemNo}
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums shrink-0">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </li>
                        );
                      })}
                      <li className="flex justify-between text-sm pt-2 border-t border-foreground/8">
                        <span className="text-muted-foreground">
                          Shipping
                          {order.shipping_service ? ` · ${order.shipping_service}` : ""}
                        </span>
                        <span className="tabular-nums">
                          {money.shipping === 0 ? "Free" : formatPrice(money.shipping)}
                        </span>
                      </li>
                      <li className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="tabular-nums">{formatPrice(money.tax)}</span>
                      </li>
                      <li className="flex justify-between text-sm font-medium pt-2 border-t border-foreground/8">
                        <span>Charged total</span>
                        <span className="tabular-nums">{formatPrice(money.total)}</span>
                      </li>
                    </ul>

                    <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mt-6 mb-2">
                      Ship to
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {order.shipping_address.full_name}
                      <br />
                      {order.shipping_address.line1}
                      {order.shipping_address.line2 && (
                        <>
                          <br />
                          {order.shipping_address.line2}
                        </>
                      )}
                      <br />
                      {order.shipping_address.city}, {order.shipping_address.state}{" "}
                      {order.shipping_address.postal_code}
                      <br />
                      {order.shipping_address.country}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                        Status
                      </h3>
                      <OrderStatusSelect
                        orderId={order.id}
                        status={isOrderReturned(order) ? "returned" : order.status}
                        locked={isOrderReturned(order) || order.status === "cancelled"}
                      />
                    </div>
                    <div>
                      <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                        Heartland Transaction
                      </h3>
                      <p className="text-xs font-mono break-all">
                        {order.heartland_transaction_id ?? "—"}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                        Retail Sales Order
                      </h3>
                      <p className="text-xs font-mono break-all">
                        {order.heartland_sales_order_id != null
                          ? String(order.heartland_sales_order_id)
                          : "—"}
                        {order.heartland_sync_status
                          ? ` (${order.heartland_sync_status})`
                          : ""}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                        Order Ref
                      </h3>
                      <p className="text-xs font-mono break-all">{order.id}</p>
                    </div>
                    <OrderTools order={order} labelsEnabled={shippingLabelsConfigured()} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
