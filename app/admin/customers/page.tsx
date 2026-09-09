import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import type { Order, Profile } from "@/lib/types";
import { formatPrice } from "@/lib/types";

export const metadata: Metadata = {
  title: "Customers",
};

type CustomerRow = {
  key: string;
  name: string;
  email: string;
  role: "admin" | "customer" | "guest";
  joined: string | null;
  orders: number;
  total: number;
};

export default async function AdminCustomersPage() {
  let profiles: Profile[] = [];
  let orders: Order[] = [];

  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    const [profileRes, orderRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*"),
    ]);
    profiles = (profileRes.data ?? []) as Profile[];
    orders = (orderRes.data ?? []) as Order[];
  }

  const byEmail = new Map<string, CustomerRow>();

  for (const profile of profiles) {
    const email = profile.email.trim().toLowerCase();
    byEmail.set(email, {
      key: email,
      name: profile.full_name?.trim() || "—",
      email: profile.email,
      role: profile.role,
      joined: profile.created_at,
      orders: 0,
      total: 0,
    });
  }

  for (const order of orders) {
    const email = (order.email || "").trim().toLowerCase();
    if (!email) continue;
    const existing = byEmail.get(email);
    const name = order.shipping_address?.full_name?.trim() || existing?.name || "Guest";
    const row: CustomerRow = existing ?? {
      key: email,
      name,
      email: order.email,
      role: "guest",
      joined: order.created_at,
      orders: 0,
      total: 0,
    };
    if (row.name === "—" && name) row.name = name;
    row.orders += 1;
    if (order.status === "paid" || order.status === "shipped") {
      row.total += Number(order.total_amount);
    }
    byEmail.set(email, row);
  }

  const customers = [...byEmail.values()].sort((a, b) => b.orders - a.orders);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {customers.length} {customers.length === 1 ? "customer" : "customers"} (accounts and
          guest checkouts).
        </p>
      </header>

      {customers.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-foreground/15">
          <p className="font-serif text-2xl mb-2">No customers yet</p>
          <p className="text-sm text-muted-foreground px-4">
            Profiles appear when someone creates an account. Guest checkouts appear after their
            first paid order.
          </p>
        </div>
      ) : (
        <>
          <ul className="md:hidden space-y-3">
            {customers.map((customer) => (
              <li key={customer.key}>
                <Link
                  href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                  className="block border border-foreground/10 p-4 space-y-2 hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground break-all">{customer.email}</p>
                    </div>
                    <Badge
                      variant={customer.role === "admin" ? "default" : "secondary"}
                      className="rounded-none text-[10px] uppercase tracking-[0.14em] shrink-0"
                    >
                      {customer.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {customer.orders} orders · {formatPrice(customer.total)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden md:block border border-foreground/10 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Joined / first order</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Lifetime Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.key}>
                    <TableCell>
                      <Link
                        href={`/admin/customers/${encodeURIComponent(customer.email)}`}
                        className="hover:underline"
                      >
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.email}</p>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={customer.role === "admin" ? "default" : "secondary"}
                        className="rounded-none text-[10px] uppercase tracking-[0.14em]"
                      >
                        {customer.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.joined
                        ? new Date(customer.joined).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{customer.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(customer.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
