export type Role = "admin" | "customer";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  created_at: string;
}

export type HeartlandSyncStatus = "pending" | "synced" | "failed";

/** One Heartland Retail sellable item (size/color) belonging to a product. */
export interface ProductVariant {
  id: string;
  product_id: string;
  heartland_item_id: number;
  heartland_public_id: string;
  heartland_grid_id: number | null;
  size: string | null;
  color: string | null;
  price: number;
  inventory_count: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Top-level or child shop category (from `public.categories`). */
export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

/** Top-level category with nested subcategories. */
export interface CategoryNode extends Category {
  children: Category[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  inventory_count: number;
  category: string;
  /** Optional subcategory slug under `category` (e.g. tees under tops). */
  subcategory: string | null;
  slug: string;
  sizes: string[];
  colors: string[];
  is_new: boolean;
  /** When the product was last marked as a new arrival; null if not new. */
  is_new_at?: string | null;
  on_sale: boolean;
  sale_price: number | null;
  /** Primary Heartland Retail internal item id (first active variant). */
  heartland_item_id: number | null;
  /** Primary Heartland Retail Item # (first active variant). */
  heartland_public_id: string | null;
  /** Loaded with product detail / admin edit; optional on list views. */
  variants?: ProductVariant[];
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Curated home page section (hero image or product rail). */
export interface HomepageSection {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  product_ids: string[];
  max_items: number;
  enabled: boolean;
  sort_order: number;
  image_url: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled" | "returned";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "shipped",
  "cancelled",
  "returned",
];

export interface OrderItem {
  product_id: string;
  variant_id?: string | null;
  heartland_item_id?: number | null;
  heartland_public_id?: string | null;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface ShippingAddress {
  full_name: string;
  email: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  email: string;
  total_amount: number;
  status: OrderStatus;
  heartland_transaction_id: string | null;
  heartland_sales_order_id: number | null;
  heartland_sync_status: HeartlandSyncStatus | null;
  heartland_sync_error?: string | null;
  tax_amount?: number | null;
  shipping_amount?: number | null;
  shipping_service?: string | null;
  shipping_service_code?: string | null;
  tracking_number?: string | null;
  tracking_carrier?: string | null;
  shipping_label_url?: string | null;
  refunded_amount?: number | null;
  refunded_at?: string | null;
  inventory_restocked_at?: string | null;
  return_requested_at?: string | null;
  return_received_at?: string | null;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  created_at: string;
}

export function isOrderReturned(
  order: Pick<Order, "status" | "refunded_at" | "refunded_amount">
): boolean {
  return (
    order.status === "returned" ||
    Boolean(order.refunded_at) ||
    order.refunded_amount != null
  );
}

export function isOrderInventoryRestocked(
  order: Pick<Order, "inventory_restocked_at" | "heartland_sync_error">
): boolean {
  if (order.inventory_restocked_at) return true;
  return String(order.heartland_sync_error ?? "").startsWith("RESTOCKED");
}

export function orderItemNumber(
  item: Pick<OrderItem, "heartland_public_id" | "heartland_item_id">
): string | null {
  if (item.heartland_public_id?.trim()) return item.heartland_public_id.trim();
  if (item.heartland_item_id != null) return String(item.heartland_item_id);
  return null;
}

export function orderMoneyBreakdown(order: Pick<Order, "items" | "total_amount" | "tax_amount" | "shipping_amount">): {
  merchandise: number;
  shipping: number;
  tax: number;
  total: number;
} {
  const merchandise = Math.round(
    order.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0) * 100
  ) / 100;
  const tax = Math.round(Number(order.tax_amount ?? 0) * 100) / 100;
  const total = Math.round(Number(order.total_amount) * 100) / 100;
  const storedShipping = order.shipping_amount == null ? null : Math.round(Number(order.shipping_amount) * 100) / 100;
  const inferred = Math.max(0, Math.round((total - merchandise - tax) * 100) / 100);
  const shipping = storedShipping != null && storedShipping > 0 ? storedShipping : inferred;
  return { merchandise, shipping, tax, total };
}

/** Merchandise + tax can be refunded. Shipping the customer paid stays with the boutique. */
export function orderRefundBreakdown(
  order: Pick<Order, "items" | "total_amount" | "tax_amount" | "shipping_amount" | "refunded_amount">
): {
  merchandise: number;
  shipping: number;
  tax: number;
  total: number;
  refundable: number;
  shippingKept: number;
  alreadyRefunded: number;
} {
  const money = orderMoneyBreakdown(order);
  const alreadyRefunded = Math.round(Number(order.refunded_amount ?? 0) * 100) / 100;
  const shippingKept = money.shipping;
  const refundableTotal = Math.max(0, Math.round((money.total - shippingKept) * 100) / 100);
  const refundable = Math.max(0, Math.round((refundableTotal - alreadyRefunded) * 100) / 100);
  return { ...money, refundable, shippingKept, alreadyRefunded };
}

/** Effective selling price (sale price when on sale). */
export function effectivePrice(p: Pick<Product, "price" | "on_sale" | "sale_price">): number {
  return p.on_sale && p.sale_price != null ? p.sale_price : p.price;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
