import { SITE_EMAIL, SITE_NAME, SOCIAL_LINKS, STORE_CONTACT, type CategoryDef } from "@/lib/constants";
import { shopHref } from "@/lib/shop";
import { effectivePrice, type Post, type Product } from "@/lib/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export interface BreadcrumbItem {
  name: string;
  /** Path relative to site root, e.g. "/shop/dresses". Omit for the current page. */
  path?: string;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/icon-512.png`,
    sameAs: [SOCIAL_LINKS.instagram, SOCIAL_LINKS.tiktok],
    email: SITE_EMAIL,
    telephone: STORE_CONTACT.phoneDisplay,
    address: {
      "@type": "PostalAddress",
      streetAddress: "415 Peachtree Parkway, Ste 235",
      addressLocality: "Cumming",
      addressRegion: "GA",
      postalCode: "30041",
      addressCountry: "US",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: SITE_EMAIL,
      telephone: STORE_CONTACT.phoneDisplay,
      contactType: "customer service",
    },
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: SITE_NAME,
    url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` },
  };
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: `${siteUrl}${item.path}` } : {}),
    })),
  };
}

export function productJsonLd(product: Product, categoryLabel?: string) {
  const price = effectivePrice(product);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.id,
    url: `${siteUrl}/products/${product.slug}`,
    ...(categoryLabel ? { category: categoryLabel } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    ...(product.colors.length > 0 ? { color: product.colors.join(", ") } : {}),
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: "USD",
      price: price.toFixed(2),
      availability:
        product.inventory_count > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${siteUrl}/#organization` },
    },
  };
}

export function collectionPageJsonLd(category: CategoryDef, products: Product[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.label} | ${SITE_NAME}`,
    description: category.description,
    url: `${siteUrl}${shopHref({ category: category.slug })}`,
    isPartOf: { "@id": `${siteUrl}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl}/products/${p.slug}`,
        name: p.name,
      })),
    },
  };
}

export function blogPostingJsonLd(post: Post) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url: `${siteUrl}/blog/${post.slug}`,
    ...(post.cover_image ? { image: [post.cover_image] } : {}),
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    author: { "@id": `${siteUrl}/#organization` },
    publisher: { "@id": `${siteUrl}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/blog/${post.slug}`,
    },
  };
}
