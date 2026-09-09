import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import type { Order, Profile } from "@/lib/types";
import { formatPrice, isOrderReturned, orderMoneyBreakdown } from "@/lib/types";

export const metadata: Metadata = {
  title: "Customer",
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = decodeURIComponent(id).trim();
  if (!email || !email.includes("@")) notFound();

  if (!supabaseConfigured()) notFound();

  const supabase = await createPrivilegedClient();
  const [{ data: profileRow }, { data: orderRows }] = await Promise.all([
    supabase.from("profiles").select("*").ilike("email", email).maybeSingle(),
    supabase.from("orders").select("*").ilike("email", email).order("created_at", { ascending: false }),
  ]);

  const profile = (profileRow ?? null) as Profile | null;
  const orders = (orderRows ?? []) as Order[];
  if (!profile && orders.length === 0) notFound();

  const name = profile?.full_name || orders[0]?.shipping_address.full_name || email;
  const ltv = orders
    .filter((order) => order.status === "paid" || order.status === "shipped")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="space-y-2">
        <Button asChild variant="ghost" className="rounded-none px-0 text-[11px] tracking-[0.16em] uppercase">
          <Link href="/admin/customers">← Customers</Link>
        </Button>
        <h1 className="font-serif text-3xl tracking-tight">{name}</h1>
        <p className="text-sm text-muted-foreground break-all">{email}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary" className="rounded-none text-[10px] uppercase tracking-[0.14em]">
            {profile?.role ?? "guest"}
          </Badge>
          <span className="text-sm text-muted-foreground tabular-nums">
            {orders.length} {orders.length === 1 ? "order" : "orders"} · {formatPrice(ltv)}
          </span>
        </div>
      </header>

      <section className="space-y-4">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders for this customer yet.</p>
        ) : (
          orders.map((order) => {
            const money = orderMoneyBreakdown(order);
            return (
              <article key={order.id} className="border border-foreground/10 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className="rounded-none text-[10px] uppercase tracking-[0.14em]"
                    >
                      {isOrderReturned(order)
                        ? "Returned"
                        : order.return_requested_at
                          ? "Return requested"
                          : order.status}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums">
                      {formatPrice(order.total_amount)}
                    </span>
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.quantity} × {item.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Shipping {money.shipping === 0 ? "free" : formatPrice(money.shipping)}
                  {order.shipping_service ? ` · ${order.shipping_service}` : ""}
                  {order.tracking_number
                    ? ` · ${order.tracking_carrier || "UPS"} ${order.tracking_number}`
                    : ""}
                </p>
                <Link
                  href="/admin/orders"
                  className="text-[11px] tracking-[0.14em] uppercase underline underline-offset-2"
                >
                  Open in orders
                </Link>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
