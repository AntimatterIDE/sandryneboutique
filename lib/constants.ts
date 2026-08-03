export const FREE_SHIPPING_THRESHOLD = 200;

export const FLAT_SHIPPING_RATE = 9.95;

export const SITE_NAME = "Sandryne Boutique";

export const SITE_EMAIL = "info@sandryneboutique.com";

export const STORE_CONTACT = {
  email: SITE_EMAIL,
  phoneDisplay: "+1 470-820-2859",
  phoneHref: "tel:+14708202859",
  addressLines: ["415 Peachtree Parkway, Ste 235", "Cumming, GA 30041"],
  hours: "Mon – Sat 10 – 6 PM",
  mapsUrl: "https://maps.app.goo.gl/FRrYMN4AdVxPCWnBA",
  mapsEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3546.80945431093!2d-84.17495192415137!3d34.152554312426766!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88f59bd1f801bf29%3A0x38d394311f187367!2ssandryne%20boutique!5e1!3m2!1sen!2sus!4v1777760369913!5m2!1sen!2sus",
} as const;

export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/sandryneboutique",
  tiktok: "https://www.tiktok.com/@sandryneboutique",
} as const;

export type CategorySlug =
  | "new-arrivals"
  | "bottoms"
  | "dresses"
  | "accessories-jewelry"
  | "tops"
  | "active-wear"
  | "sale";

export interface CategoryDef {
  slug: CategorySlug;
  label: string;
  /** DB category value; null for virtual categories (new-arrivals, sale) */
  dbCategory: string | null;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "new-arrivals",
    label: "New Arrivals",
    dbCategory: null,
    description: "Be first to wear the story — this week's fresh picks.",
  },
  {
    slug: "bottoms",
    label: "Bottoms",
    dbCategory: "bottoms",
    description: "Tailored trousers, skirts, and denim with timeless lines.",
  },
  {
    slug: "dresses",
    label: "Dresses",
    dbCategory: "dresses",
    description: "Effortless silhouettes for every hour of the day.",
  },
  {
    slug: "tops",
    label: "Tops",
    dbCategory: "tops",
    description: "From crisp poplin to fluid silk — modern minimalism.",
  },
  {
    slug: "active-wear",
    label: "Active Wear",
    dbCategory: "active-wear",
    description: "Movement, elevated. Performance meets polish.",
  },
  {
    slug: "accessories-jewelry",
    label: "Accessories & Jewelry",
    dbCategory: "accessories-jewelry",
    description: "The finishing touches — curated pieces that elevate.",
  },
  {
    slug: "sale",
    label: "Sale",
    dbCategory: null,
    description: "Elevated looks, gracefully priced.",
  },
];

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
