import {
  Activity,
  FileText,
  Folders,
  Home,
  LayoutDashboard,
  Mail,
  Package,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match nested routes (e.g. /admin/products/new). */
  match?: "exact" | "prefix";
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, match: "exact" },
  { href: "/admin/homepage", label: "Homepage", icon: Home, match: "prefix" },
  { href: "/admin/products", label: "Products", icon: Package, match: "prefix" },
  { href: "/admin/categories", label: "Categories", icon: Folders, match: "prefix" },
  { href: "/admin/posts", label: "Journal", icon: FileText, match: "prefix" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, match: "prefix" },
  { href: "/admin/customers", label: "Customers", icon: Users, match: "prefix" },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail, match: "prefix" },
  { href: "/admin/integrations", label: "Integrations", icon: Activity, match: "prefix" },
];

export function isAdminNavActive(pathname: string, item: AdminNavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
