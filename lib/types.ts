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

/** Curated home page product rail (admin-managed). */
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
  updated_at: string;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";

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
  shipping_address: ShippingAddress;
  items: OrderItem[];
  created_at: string;
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
