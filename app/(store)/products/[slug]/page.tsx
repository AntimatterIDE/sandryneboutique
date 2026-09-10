import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductGallery } from "@/components/product/product-gallery";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { ProductCard } from "@/components/product/product-card";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { getProductBySlug, getProducts } from "@/lib/data/products";
import { getCategory, CATEGORIES } from "@/lib/constants";
import { effectivePrice, formatPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found", robots: { index: false } };

  const categoryDef =
    CATEGORIES.find((c) => c.dbCategory === product.category) ??
    getCategory(product.category);
  const price = effectivePrice(product);
  const title = categoryDef
    ? `${product.name} — ${categoryDef.label}`
    : product.name;
  const description = `${product.description} Shop the ${product.name} for ${formatPrice(
    price
  )} at Sandryne Boutique — free shipping over $200 and easy returns.`;

  return {
    title,
    description,
    keywords: [
      product.name,
      ...(categoryDef ? [categoryDef.label.toLowerCase()] : []),
      ...product.colors.map((c) => `${c.toLowerCase()} ${product.category}`),
      "women's fashion",
      "Sandryne Boutique",
    ],
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title,
      description: product.description,
      url: `/products/${product.slug}`,
      type: "website",
      images: product.images[0]
        ? [{ url: product.images[0], alt: product.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.description,
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const categoryDef =
    CATEGORIES.find((c) => c.dbCategory === product.category) ?? getCategory(product.category);
  const related = (
    await getProducts({ category: product.category, limit: 5 })
  )
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const price = effectivePrice(product);

  const breadcrumbs = [
    { name: "Home", path: "/" },
    ...(categoryDef
      ? [{ name: categoryDef.label, path: `/shop?category=${categoryDef.slug}` }]
      : []),
    { name: product.name },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-16">
      <JsonLd
        data={[
          productJsonLd(product, categoryDef?.label),
          breadcrumbJsonLd(breadcrumbs),
        ]}
      />
      <nav aria-label="Breadcrumb" className="mb-8 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          {categoryDef && (
            <>
              <li>
                <Link
                  href={`/shop?category=${categoryDef.slug}`}
                  className="hover:text-foreground transition-colors"
                >
                  {categoryDef.label}
                </Link>
              </li>
              <li aria-hidden>/</li>
            </>
          )}
          <li className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-36">
            <ProductGallery images={product.images} name={product.name} />
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              {product.is_new && (
                <span className="bg-secondary px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase">
                  New
                </span>
              )}
              {product.on_sale && (
                <span className="bg-foreground text-background px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase">
                  Sale
                </span>
              )}
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl tracking-tight leading-tight mb-4">
              {product.name}
            </h1>
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "text-xl tabular-nums",
                  product.on_sale && "text-destructive"
                )}
              >
                {formatPrice(price)}
              </span>
              {product.on_sale && (
                <span className="text-muted-foreground line-through tabular-nums">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>
            {product.on_sale ? (
              <p className="mt-2 text-xs tracking-[0.14em] uppercase text-muted-foreground">
                Final sale — no returns
              </p>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description}
          </p>

          <PurchasePanel product={product} />

          <Accordion type="single" collapsible className="border-t border-foreground/8">
            <AccordionItem value="shipping">
              <AccordionTrigger className="text-[11px] tracking-[0.2em] uppercase font-normal">
                Shipping &amp; Returns
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                Orders ship within 1–2 business days. Free standard shipping on orders over
                $200. Returns accepted within 14 days of delivery — see our{" "}
                <Link href="/policies/returns" className="underline underline-offset-4">
                  returns policy
                </Link>{" "}
                for details.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="care">
              <AccordionTrigger className="text-[11px] tracking-[0.2em] uppercase font-normal">
                Fabric &amp; Care
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                Crafted from considered, quality fabrics. To keep each piece at its best,
                follow the care label — when in doubt, a cold gentle cycle or dry clean
                preserves drape and color.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-serif text-3xl sm:text-4xl tracking-tight mb-10">
            Pair <em className="italic font-light">with</em>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
