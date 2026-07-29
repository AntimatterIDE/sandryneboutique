import type { Metadata } from "next";
import { Suspense } from "react";
import BlurHighlight from "@/components/react-bits/blur-highlight";
import { FilterBar } from "@/components/product/filter-bar";
import { ProductCard } from "@/components/product/product-card";
import { CatalogPagination } from "@/components/ui/catalog-pagination";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, collectionPageJsonLd } from "@/lib/seo/jsonld";
import { SITE_NAME, getCategory } from "@/lib/constants";
import { getProducts, getProductsPage, type ProductSort } from "@/lib/data/products";
import { SHOP_PAGE_SIZE, shopHref } from "@/lib/shop";
import { effectivePrice } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const collection = first(sp.category);
  const def = collection ? getCategory(collection) : null;

  if (def) {
    const title = def.dbCategory
      ? `Women's ${def.label} — Curated Luxury`
      : `${def.label} — Curated Women's Fashion`;
    const description = `${def.description} Shop ${def.label.toLowerCase()} at ${SITE_NAME} — curated luxury women's fashion with free shipping over $200.`;
    const url = shopHref({ category: def.slug });
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title: `${def.label} | ${SITE_NAME}`, description, url },
    };
  }

  return {
    title: "Shop — Curated Women's Fashion",
    description: `Shop curated luxury women's fashion at ${SITE_NAME}. Filter by category, size, and color.`,
    alternates: { canonical: "/shop" },
  };
}

export default async function ShopPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const collection = first(sp.category);
  const def = collection ? getCategory(collection) : null;

  const search = first(sp.q)?.trim();
  const sort = (first(sp.sort) as ProductSort | undefined) ?? "newest";
  const size = first(sp.size);
  const color = first(sp.color);
  const max = first(sp.max) ? Number(first(sp.max)) : undefined;
  const page = Math.max(1, Number(first(sp.page) ?? "1") || 1);

  const baseQuery = {
    collection: def?.slug,
    search,
    shoppableOnly: true as const,
  };

  const [allForFacets, pageResult] = await Promise.all([
    getProducts(baseQuery),
    getProductsPage({
      ...baseQuery,
      sort,
      size,
      color,
      maxPrice: max,
      page,
      pageSize: SHOP_PAGE_SIZE,
    }),
  ]);

  const availableSizes = [...new Set(allForFacets.flatMap((p) => p.sizes))];
  const availableColors = [...new Set(allForFacets.flatMap((p) => p.colors))].sort();
  const maxCatalogPrice = Math.ceil(
    Math.max(0, ...allForFacets.map((p) => effectivePrice(p)), 100)
  );

  const title = def?.label ?? "Shop";
  const description =
    def?.description ??
    "Curated pieces for every hour of the day — filter by category, size, and color.";

  const hrefForPage = (p: number) =>
    shopHref({
      q: search,
      category: def?.slug,
      size,
      color,
      sort,
      max,
      page: p,
    });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
      <JsonLd
        data={[
          def
            ? collectionPageJsonLd(def, allForFacets)
            : {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                name: "Shop",
                url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/shop`,
              },
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/shop" },
            ...(def ? [{ name: def.label }] : []),
          ]),
        ]}
      />

      <header className="mb-10 sm:mb-14 max-w-2xl">
        <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-4">
          Sandryne Boutique
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl tracking-tight mb-5">{title}</h1>
        <BlurHighlight
          className="text-muted-foreground leading-relaxed"
          blurAmount={6}
          viewportOptions={{ once: true, amount: 0.4 }}
        >
          {description}
        </BlurHighlight>
      </header>

      <div className="mb-8">
        <Suspense>
          <FilterBar
            availableSizes={availableSizes}
            availableColors={availableColors}
            maxCatalogPrice={maxCatalogPrice}
            resultCount={pageResult.total}
            activeCategory={def?.slug ?? null}
          />
        </Suspense>
      </div>

      {pageResult.products.length === 0 ? (
        <div className="py-24 text-center">
          <p className="font-serif text-3xl mb-3">Nothing here yet</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your filters — or check back soon for new pieces.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
            {pageResult.products.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
          <CatalogPagination
            page={pageResult.page}
            totalPages={pageResult.totalPages}
            hrefForPage={hrefForPage}
          />
        </>
      )}
    </div>
  );
}
