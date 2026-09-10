export const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=1600&auto=format&fit=crop";

/** Women's-only fallbacks if a category has no shoppable product photo yet. */
export const DEFAULT_CATEGORY_TILE_IMAGES = {
  bottoms:
    "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=800&auto=format&fit=crop",
  dresses:
    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop",
  tops:
    "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?q=80&w=800&auto=format&fit=crop",
} as const;

export const CATEGORY_TILE_SLOTS = [
  {
    id: "category_tile_bottoms",
    slug: "bottoms",
    label: "Bottoms",
    href: "/shop?category=bottoms",
  },
  {
    id: "category_tile_dresses",
    slug: "dresses",
    label: "Dresses",
    href: "/shop?category=dresses",
  },
  {
    id: "category_tile_tops",
    slug: "tops",
    label: "Tops",
    href: "/shop?category=tops",
  },
] as const;

export type CategoryTileSlug = (typeof CATEGORY_TILE_SLOTS)[number]["slug"];
