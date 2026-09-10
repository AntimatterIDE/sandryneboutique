import { createClient } from "@/lib/supabase/server";
import { getProducts, getProductsByIds, supabaseConfigured } from "@/lib/data/products";
import {
  CATEGORY_TILE_SLOTS,
  DEFAULT_CATEGORY_TILE_IMAGES,
  DEFAULT_HERO_IMAGE,
  type CategoryTileSlug,
} from "@/lib/homepage-defaults";
import type { HomepageSection, Product } from "@/lib/types";

export interface CategoryShowcaseTile {
  slug: CategoryTileSlug;
  label: string;
  href: string;
  image: string;
}

const DEFAULT_SECTIONS: HomepageSection[] = [
  {
    id: "hero",
    label: "Hero",
    title: "Summer, Elevated.",
    subtitle: "The Summer '26 Edit",
    cta_label: "Explore Summer Collection",
    cta_href: "/shop?category=new-arrivals",
    product_ids: [],
    max_items: 8,
    enabled: true,
    sort_order: 0,
    image_url: DEFAULT_HERO_IMAGE,
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "featured_carousel",
    label: "Featured carousel",
    title: "Fresh Summer Picks",
    subtitle: "This Week's",
    cta_label: "View all new arrivals",
    cta_href: "/shop?category=new-arrivals",
    product_ids: [],
    max_items: 8,
    enabled: true,
    sort_order: 10,
    image_url: "",
    updated_at: new Date(0).toISOString(),
  },
  {
    id: "new_arrivals",
    label: "New arrivals grid",
    title: "New Arrivals",
    subtitle: "Just In",
    cta_label: "Explore all",
    cta_href: "/shop?category=new-arrivals",
    product_ids: [],
    max_items: 8,
    enabled: true,
    sort_order: 20,
    image_url: "",
    updated_at: new Date(0).toISOString(),
  },
  ...CATEGORY_TILE_SLOTS.map((slot, index) => ({
    id: slot.id,
    label: `Category tile — ${slot.label}`,
    title: slot.label,
    subtitle: "Shop by Category",
    cta_label: "Shop now",
    cta_href: slot.href,
    product_ids: [] as string[],
    max_items: 1,
    enabled: true,
    sort_order: 3 + index,
    image_url: "",
    updated_at: new Date(0).toISOString(),
  })),
];

function normalizeSection(row: HomepageSection): HomepageSection {
  return {
    ...row,
    product_ids: Array.isArray(row.product_ids) ? row.product_ids : [],
    image_url: typeof row.image_url === "string" ? row.image_url : "",
  };
}

export async function getHomepageSections(): Promise<HomepageSection[]> {
  if (!supabaseConfigured()) return DEFAULT_SECTIONS;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homepage_sections")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    // Table may not exist yet before migration 005 is applied.
    console.error("Failed to fetch homepage sections:", error.message);
    return DEFAULT_SECTIONS;
  }

  const rows = ((data ?? []) as HomepageSection[]).map(normalizeSection);
  if (rows.length === 0) return DEFAULT_SECTIONS;

  const byId = new Map(rows.map((section) => [section.id, section]));
  const known = DEFAULT_SECTIONS.map((fallback) => byId.get(fallback.id) ?? fallback);
  const extras = rows.filter((section) => !DEFAULT_SECTIONS.some((d) => d.id === section.id));
  return [...known, ...extras].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getHomepageSection(id: string): Promise<HomepageSection | null> {
  const sections = await getHomepageSections();
  return sections.find((s) => s.id === id) ?? null;
}

/**
 * Resolve products for a section. When product_ids is empty, fall back to
 * shoppable catalog defaults so the storefront never looks broken.
 */
export async function getSectionProducts(section: HomepageSection): Promise<Product[]> {
  const limit = section.max_items;

  if (section.product_ids.length > 0) {
    const fetched = await getProductsByIds(section.product_ids);
    const byId = new Map(fetched.map((p) => [p.id, p]));
    return section.product_ids
      .map((id) => byId.get(id))
      .filter((p): p is Product => Boolean(p))
      .filter((p) => p.inventory_count > 0 && p.images.length > 0)
      .slice(0, limit);
  }

  if (section.id === "new_arrivals") {
    return getProducts({ isNew: true, shoppableOnly: true, limit });
  }

  return getProducts({ sort: "newest", shoppableOnly: true, limit });
}

function fallbackTileImage(slug: CategoryTileSlug): string {
  return DEFAULT_CATEGORY_TILE_IMAGES[slug];
}

/** Three homepage category tiles: admin product/photo, else a live catalog photo. */
export async function getCategoryShowcaseTiles(
  sections: HomepageSection[]
): Promise<CategoryShowcaseTile[]> {
  return Promise.all(
    CATEGORY_TILE_SLOTS.map(async (slot) => {
      const section = sections.find((row) => row.id === slot.id);
      const override = section?.image_url?.trim();
      let product: Product | null = null;
      const pickedId = section?.product_ids?.[0];
      if (pickedId) {
        const found = await getProductsByIds([pickedId]);
        product = found[0] ?? null;
      }
      if (!product) {
        const catalog = await getProducts({
          category: slot.slug,
          shoppableOnly: true,
          limit: 1,
        });
        product = catalog[0] ?? null;
      }
      return {
        slug: slot.slug,
        label: section?.title?.trim() || slot.label,
        href: section?.cta_href?.trim() || slot.href,
        image: override || product?.images[0] || fallbackTileImage(slot.slug),
      };
    })
  );
}
