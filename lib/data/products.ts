import { createClient } from "@/lib/supabase/server";
import { FALLBACK_PRODUCTS } from "@/lib/data/fallback-catalog";
import { CATEGORIES, getCategory } from "@/lib/constants";
import type { Product, ProductVariant } from "@/lib/types";
import { effectivePrice } from "@/lib/types";

export type ProductSort = "newest" | "price-asc" | "price-desc";

export interface ProductQuery {
  category?: string;
  /** Category slug from CATEGORIES (tops, new-arrivals, sale, …). Overrides `category` when set. */
  collection?: string;
  onSale?: boolean;
  isNew?: boolean;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  sort?: ProductSort;
  limit?: number;
  page?: number;
  pageSize?: number;
  search?: string;
  /**
   * Storefront default: only products with at least one image and inventory > 0.
   * Set false for admin / internal lookups.
   */
  shoppableOnly?: boolean;
  /** When true, attach `variants` to each product. */
  includeVariants?: boolean;
}

export interface ProductPageResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Customer-facing catalog rule: at least one photo and available inventory. */
export function isShoppable(product: Product): boolean {
  return product.inventory_count > 0 && product.images.length > 0;
}

/**
 * PostgREST `or` filters matching a term against product names and primary
 * Heartland identifiers. Variant Item # matches are OR'd via product ids
 * separately (see `productIdsMatchingVariantSearch`).
 */
export function productSearchFilters(rawTerm: string, extraProductIds: string[] = []): string[] {
  const term = rawTerm.trim().replace(/[%_,(){}"\\]/g, "");
  if (!term) return [];

  const filters = [
    `name.ilike.%${term}%`,
    `slug.ilike.%${term}%`,
    `heartland_public_id.ilike.%${term}%`,
  ];

  if (/^\d+$/.test(term)) {
    filters.push(`heartland_item_id.eq.${Number(term)}`);
  }

  if (extraProductIds.length > 0) {
    filters.push(`id.in.(${extraProductIds.join(",")})`);
  }

  return filters;
}

export async function productIdsMatchingVariantSearch(term: string): Promise<string[]> {
  const cleaned = term.trim().replace(/[%_,(){}"\\]/g, "");
  if (!cleaned || !supabaseConfigured()) return [];

  const supabase = await createClient();
  const filters = [`heartland_public_id.ilike.%${cleaned}%`];
  if (/^\d+$/.test(cleaned)) {
    filters.push(`heartland_item_id.eq.${Number(cleaned)}`);
  }

  const { data, error } = await supabase
    .from("product_variants")
    .select("product_id")
    .or(filters.join(","))
    .limit(200);

  if (error) {
    console.error("Variant search failed:", error);
    return [];
  }

  return [...new Set((data ?? []).map((row) => row.product_id as string))];
}

export async function getVariantsByProductIds(
  productIds: string[]
): Promise<Map<string, ProductVariant[]>> {
  const map = new Map<string, ProductVariant[]>();
  if (productIds.length === 0) return map;

  if (!supabaseConfigured()) {
    for (const id of productIds) {
      const product = FALLBACK_PRODUCTS.find((p) => p.id === id);
      map.set(id, product?.variants ?? []);
    }
    return map;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .in("product_id", productIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch product variants:", error);
    return map;
  }

  for (const row of (data ?? []) as ProductVariant[]) {
    const list = map.get(row.product_id) ?? [];
    list.push(row);
    map.set(row.product_id, list);
  }
  return map;
}

async function attachVariants(products: Product[]): Promise<Product[]> {
  if (products.length === 0) return products;
  const byProduct = await getVariantsByProductIds(products.map((p) => p.id));
  return products.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] }));
}

function resolveCollectionFlags(q: ProductQuery): ProductQuery {
  if (!q.collection) return q;
  const def = getCategory(q.collection);
  if (!def) return { ...q, collection: undefined };

  if (def.slug === "new-arrivals") {
    return { ...q, collection: undefined, category: undefined, isNew: true };
  }
  if (def.slug === "sale") {
    return { ...q, collection: undefined, category: undefined, onSale: true };
  }
  return {
    ...q,
    collection: undefined,
    category: def.dbCategory ?? undefined,
    isNew: undefined,
    onSale: undefined,
  };
}

function applyLocalQuery(products: Product[], raw: ProductQuery): Product[] {
  const q = resolveCollectionFlags(raw);
  const shoppableOnly = q.shoppableOnly !== false;

  let result = products.filter((p) => {
    if (shoppableOnly && !isShoppable(p)) return false;
    if (q.category && p.category !== q.category) return false;
    if (q.onSale && !p.on_sale) return false;
    if (q.isNew && !p.is_new) return false;
    if (q.size && !p.sizes.includes(q.size)) return false;
    if (q.color && !p.colors.includes(q.color)) return false;
    if (q.search) {
      const needle = q.search.toLowerCase();
      const variantHay = (p.variants ?? [])
        .flatMap((v) => [v.heartland_public_id, v.heartland_item_id, v.size, v.color])
        .filter((value) => value != null)
        .join(" ");
      const hay = [
        p.name,
        p.slug,
        p.description,
        p.heartland_public_id,
        p.heartland_item_id,
        variantHay,
      ]
        .filter((value) => value != null)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const price = effectivePrice(p);
    if (q.minPrice != null && price < q.minPrice) return false;
    if (q.maxPrice != null && price > q.maxPrice) return false;
    return true;
  });

  switch (q.sort) {
    case "price-asc":
      result = result.toSorted((a, b) => effectivePrice(a) - effectivePrice(b));
      break;
    case "price-desc":
      result = result.toSorted((a, b) => effectivePrice(b) - effectivePrice(a));
      break;
    default:
      result = result.toSorted(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }

  return q.limit ? result.slice(0, q.limit) : result;
}

function paginateLocal(products: Product[], page: number, pageSize: number): ProductPageResult {
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    products: products.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export async function getProducts(q: ProductQuery = {}): Promise<Product[]> {
  // Unpaginated listing for facets / menus (PostgREST typically caps ~1000 rows).
  const page = await getProductsPage({
    ...q,
    page: 1,
    pageSize: q.limit ?? 1000,
  });
  return page.products;
}

export async function getProductsPage(raw: ProductQuery = {}): Promise<ProductPageResult> {
  const q = resolveCollectionFlags(raw);
  const shoppableOnly = q.shoppableOnly !== false;
  const pageSize = Math.max(1, q.pageSize ?? q.limit ?? 24);
  const page = Math.max(1, q.page ?? 1);

  if (!supabaseConfigured()) {
    const filtered = applyLocalQuery(FALLBACK_PRODUCTS, { ...q, limit: undefined });
    return paginateLocal(filtered, page, pageSize);
  }

  const supabase = await createClient();
  let query = supabase.from("products").select("*", { count: "exact" });

  if (shoppableOnly) {
    query = query.gt("inventory_count", 0).not("images", "eq", "{}");
  }
  if (q.category) query = query.eq("category", q.category);
  if (q.onSale) query = query.eq("on_sale", true);
  if (q.isNew) query = query.eq("is_new", true);
  if (q.size) query = query.contains("sizes", [q.size]);
  if (q.color) query = query.contains("colors", [q.color]);
  if (q.search?.trim()) {
    const variantProductIds = await productIdsMatchingVariantSearch(q.search);
    const searchFilters = productSearchFilters(q.search, variantProductIds);
    if (searchFilters.length > 0) query = query.or(searchFilters.join(","));
  }

  switch (q.sort) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const needsPriceFilter = q.minPrice != null || q.maxPrice != null;

  if (needsPriceFilter) {
    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch products:", error);
      return { products: [], total: 0, page: 1, pageSize, totalPages: 1 };
    }

    let products = (data ?? []) as Product[];
    products = products.filter((p) => {
      const price = effectivePrice(p);
      if (q.minPrice != null && price < q.minPrice) return false;
      if (q.maxPrice != null && price > q.maxPrice) return false;
      return true;
    });
    const pageResult = paginateLocal(products, page, pageSize);
    if (q.includeVariants) {
      pageResult.products = await attachVariants(pageResult.products);
    }
    return pageResult;
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("Failed to fetch products:", error);
    return { products: [], total: 0, page: 1, pageSize, totalPages: 1 };
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let products = (data ?? []) as Product[];
  if (q.includeVariants) {
    products = await attachVariants(products);
  }
  return {
    products,
    total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!supabaseConfigured()) {
    return FALLBACK_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch product:", error);
    return null;
  }
  if (!data) return null;

  const product = data as Product;
  const variants = await getVariantsByProductIds([product.id]);
  return { ...product, variants: variants.get(product.id) ?? [] };
}

export interface MenuProduct {
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  description: string;
}

function toMenuProduct(p: Product): MenuProduct {
  return {
    slug: p.slug,
    name: p.name,
    price: effectivePrice(p),
    compareAtPrice: p.on_sale ? p.price : null,
    image: p.images[0] ?? null,
    description: p.description,
  };
}

/**
 * Products grouped by category slug for the header mega menu.
 * Virtual categories: new-arrivals (is_new), sale (on_sale).
 */
export async function getMegaMenuProducts(
  perCategory = 4
): Promise<Record<string, MenuProduct[]>> {
  const all = await getProducts({ shoppableOnly: true });
  const map: Record<string, MenuProduct[]> = {};

  for (const cat of CATEGORIES) {
    let items: Product[];
    if (cat.slug === "new-arrivals") {
      items = all.filter((p) => p.is_new);
      if (items.length === 0) items = all;
    } else if (cat.slug === "sale") {
      items = all.filter((p) => p.on_sale);
    } else {
      items = all.filter((p) => p.category === cat.dbCategory);
    }
    map[cat.slug] = items.slice(0, perCategory).map(toMenuProduct);
  }

  return map;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];

  if (!supabaseConfigured()) {
    return FALLBACK_PRODUCTS.filter((p) => ids.includes(p.id));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").in("id", ids);

  if (error) {
    console.error("Failed to fetch products by ids:", error);
    return [];
  }
  return (data ?? []) as Product[];
}
