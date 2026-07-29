import { CATEGORIES, getCategory, type CategorySlug } from "@/lib/constants";

export const SHOP_PAGE_SIZE = 24;

export interface ShopSearchParams {
  q?: string | null;
  category?: string | null;
  size?: string | null;
  color?: string | null;
  sort?: string | null;
  max?: string | number | null;
  page?: string | number | null;
}

/** Build `/shop?...` URLs for nav, filters, and pagination. */
export function shopHref(opts: ShopSearchParams = {}): string {
  const params = new URLSearchParams();

  if (opts.q?.trim()) params.set("q", opts.q.trim());
  if (opts.category) {
    const def = getCategory(opts.category);
    if (def) params.set("category", def.slug);
  }
  if (opts.size) params.set("size", String(opts.size));
  if (opts.color) params.set("color", String(opts.color));
  if (opts.sort && opts.sort !== "newest") params.set("sort", String(opts.sort));
  if (opts.max != null && opts.max !== "") params.set("max", String(opts.max));
  if (opts.page != null && Number(opts.page) > 1) params.set("page", String(opts.page));

  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

export function parseShopCategory(raw: string | null | undefined) {
  if (!raw) return null;
  return getCategory(raw) ?? null;
}

export function shopCategoryOptions(): Array<{ slug: CategorySlug | "all"; label: string }> {
  return [{ slug: "all", label: "All" }, ...CATEGORIES.map((c) => ({ slug: c.slug, label: c.label }))];
}
