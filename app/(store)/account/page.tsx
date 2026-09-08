import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import { getSessionInfo } from "@/lib/auth";
import { isAuthBypassEnabled } from "@/lib/auth-config";
import { signOut } from "@/app/actions/auth";
import type { Order } from "@/lib/types";
import { formatPrice } from "@/lib/types";

export const metadata: Metadata = {
  title: "My Account",
};

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  cancelled: "Cancelled",
  returned: "Returned",
};

export default async function AccountPage() {
  const bypass = isAuthBypassEnabled();
  const { user, profile } = await getSessionInfo();
  if (!user) redirect("/login?next=/account");

  let orders: Order[] = [];
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { data: orderRows } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    orders = (orderRows ?? []) as Order[];
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      {bypass && (
        <p className="mb-8 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          Demo mode — you are signed in as a synthetic admin user. Real accounts activate when{" "}
          <code className="font-mono text-xs">AUTH_BYPASS</code> is disabled.
        </p>
      )}
      <header className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-3">
            My Account
          </p>
          <h1 className="font-serif text-4xl tracking-tight">
            {profile?.full_name || user.email}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === "admin" && (
            <Button asChild variant="outline" className="rounded-none text-[11px] tracking-[0.18em] uppercase">
              <Link href="/admin">Admin Panel</Link>
            </Button>
          )}
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              className="rounded-none text-[11px] tracking-[0.18em] uppercase"
            >
              Sign Out
            </Button>
          </form>
        </div>
      </header>

      <Separator className="mb-10" />

      <section>
        <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-6">
          Order History
        </h2>

        {orders.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-foreground/15">
            <p className="font-serif text-2xl mb-3">No orders yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              When you place your first order, it will appear here.
            </p>
            <Button asChild variant="outline" className="rounded-none tracking-[0.18em] uppercase text-xs">
              <Link href="/shop?category=new-arrivals">Explore New Arrivals</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <article key={order.id} className="border border-foreground/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
                      {STATUS_LABELS[order.status]}
                    </Badge>
                    <span className="text-sm font-medium tabular-nums">
                      {formatPrice(order.total_amount)}
                    </span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity} × {item.name}
                        {(item.size || item.color) && (
                          <span className="text-muted-foreground/70">
                            {" "}
                            ({[item.size, item.color].filter(Boolean).join(" · ")})
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
