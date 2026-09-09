import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AccountOrderCard } from "@/components/account/order-card";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import { getSessionInfo } from "@/lib/auth";
import { isAuthBypassEnabled } from "@/lib/auth-config";
import { signOut } from "@/app/actions/auth";
import type { Order } from "@/lib/types";

export const metadata: Metadata = {
  title: "My Account",
};

export default async function AccountPage() {
  const bypass = isAuthBypassEnabled();
  const { user, profile } = await getSessionInfo();
  if (!user) redirect("/login?next=/account");

  let orders: Order[] = [];
  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    const { data: byUser } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const { data: byEmail } = user.email
      ? await supabase
          .from("orders")
          .select("*")
          .ilike("email", user.email)
          .order("created_at", { ascending: false })
      : { data: [] };
    const seen = new Set<string>();
    orders = [...(byUser ?? []), ...(byEmail ?? [])].filter((order) => {
      if (seen.has(order.id)) return false;
      seen.add(order.id);
      return true;
    }) as Order[];
    orders.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
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
          Orders
        </h2>

        {orders.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-foreground/15">
            <p className="font-serif text-2xl mb-3">No orders yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Guest and account orders placed with this email will appear here.
            </p>
            <Button asChild variant="outline" className="rounded-none tracking-[0.18em] uppercase text-xs">
              <Link href="/shop?category=new-arrivals">Explore New Arrivals</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <AccountOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
