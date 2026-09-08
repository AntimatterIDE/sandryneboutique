import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Home,
  Mail,
  Package,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OrdersByStatusChart,
  RevenueOverTimeChart,
  type RevenuePoint,
  type StatusPoint,
} from "@/components/admin/revenue-charts";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import type { Order } from "@/lib/types";
import { formatPrice } from "@/lib/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

const REVENUE_STATUSES: Order["status"][] = ["paid", "shipped"];

export default async function AdminDashboardPage() {
  let orders: Order[] = [];
  let productCount = 0;
  let lowStockCount = 0;
  let subscriberCount = 0;

  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    const [
      { data: orderRows },
      { count },
      { count: lowStock },
      { count: subs },
    ] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .lte("inventory_count", 5),
      supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
    ]);
    orders = (orderRows ?? []) as Order[];
    productCount = count ?? 0;
    lowStockCount = lowStock ?? 0;
    subscriberCount = subs ?? 0;
  }

  const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const totalRevenue = revenueOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const orderCount = orders.length;
  const averageOrderValue = revenueOrders.length > 0 ? totalRevenue / revenueOrders.length : 0;

  const days: RevenuePoint[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayOrders = revenueOrders.filter((o) => o.created_at.slice(0, 10) === key);
    days.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: Math.round(dayOrders.reduce((s, o) => s + Number(o.total_amount), 0) * 100) / 100,
      orders: dayOrders.length,
    });
  }

  const statusData: StatusPoint[] = (["pending", "paid", "shipped", "cancelled", "returned"] as const).map(
    (status) => ({
      status: status[0].toUpperCase() + status.slice(1),
      count: orders.filter((o) => o.status === status).length,
    })
  );

  const stats = [
    { label: "Total Revenue", value: formatPrice(totalRevenue), icon: DollarSign },
    { label: "Orders", value: String(orderCount), icon: ShoppingBag },
    { label: "Avg. Order Value", value: formatPrice(averageOrderValue), icon: TrendingUp },
    { label: "Products", value: String(productCount ?? 0), icon: Package },
  ];

  const shortcuts = [
    {
      href: "/admin/integrations",
      label: "Integrations health",
      value: "Check",
      hint: "Env vars + Heartland connectivity",
      icon: Activity,
    },
    {
      href: "/admin/orders?status=pending",
      label: "Pending orders",
      value: String(pendingOrders),
      hint: "Need fulfillment attention",
      icon: ShoppingBag,
    },
    {
      href: "/admin/products?stock=low",
      label: "Low stock",
      value: String(lowStockCount),
      hint: "Inventory ≤ 5 units",
      icon: AlertTriangle,
    },
    {
      href: "/admin/newsletter",
      label: "Newsletter list",
      value: String(subscriberCount),
      hint: "Export or prune subscribers",
      icon: Mail,
    },
    {
      href: "/admin/homepage",
      label: "Homepage rails",
      value: "Edit",
      hint: "Featured & new arrivals",
      icon: Home,
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          A quick pulse on sales, stock, and what needs your attention.
        </p>
      </header>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-none shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 px-4 pt-4 sm:px-6 sm:pt-6">
              <CardTitle className="text-[10px] sm:text-[11px] tracking-[0.16em] uppercase text-muted-foreground font-normal leading-snug">
                {stat.label}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              <p className="text-xl sm:text-2xl font-medium tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-4 border border-foreground/10 px-4 py-4 sm:px-5 hover:border-foreground/30 hover:bg-muted/40 transition-colors"
          >
            <div className="flex size-10 items-center justify-center border border-foreground/10 shrink-0">
              <item.icon className="size-4" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-sm tabular-nums shrink-0">{item.value}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
            </div>
            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RevenueOverTimeChart data={days} />
        <OrdersByStatusChart data={statusData} />
      </div>
    </div>
  );
}
