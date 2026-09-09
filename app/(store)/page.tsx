import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero1 } from "@/components/blocks/hero-1";
import { TaglineMarquee } from "@/components/home/tagline-marquee";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { ProductCard } from "@/components/product/product-card";
import RevealText from "@/components/react-bits/reveal-text";
import { LazySection } from "@/components/ui/lazy-section";
import {
  getHomepageSections,
  getSectionProducts,
} from "@/lib/data/homepage";

const ArrivalsCarousel = dynamic(
  () =>
    import("@/components/home/arrivals-carousel").then((m) => ({
      default: m.ArrivalsCarousel,
    })),
  {
    loading: () => (
      <section
        className="py-20 sm:py-28 border-y border-foreground/8 bg-card"
        aria-hidden
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-[440px] sm:h-[540px] bg-muted/30 animate-pulse" />
      </section>
    ),
  },
);

const BrandSection = dynamic(
  () =>
    import("@/components/home/brand-section").then((m) => ({
      default: m.BrandSection,
    })),
  {
    loading: () => (
      <section className="bg-foreground min-h-[480px]" aria-hidden />
    ),
  },
);

export const metadata: Metadata = {
  title: {
    absolute:
      "Sandryne Boutique — Curated Luxury Women's Fashion | Dresses, Tops & Jewelry",
  },
  description:
    "Shop curated luxury women's fashion at Sandryne Boutique: silk dresses, elevated tops and bottoms, active wear, and gold vermeil jewelry. Free shipping over $200, easy returns, and 10% off your first order.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sandryne Boutique — Curated Luxury Women's Fashion",
    description:
      "Timeless silhouettes and modern minimalism — dresses, tops, bottoms, active wear, accessories and jewelry, curated for an effortless, elevated look.",
    url: "/",
  },
};

export default async function HomePage() {
  const sections = await getHomepageSections();
  const hero = sections.find((s) => s.id === "hero");
  const carousel = sections.find((s) => s.id === "featured_carousel");
  const arrivals = sections.find((s) => s.id === "new_arrivals");

  const [carouselProducts, arrivalProducts] = await Promise.all([
    carousel?.enabled ? getSectionProducts(carousel) : Promise.resolve([]),
    arrivals?.enabled ? getSectionProducts(arrivals) : Promise.resolve([]),
  ]);

  return (
    <>
      <Hero1
        imageUrl={hero?.image_url}
        title={hero?.title}
        subtitle={hero?.subtitle}
        ctaLabel={hero?.cta_label}
        ctaHref={hero?.cta_href}
      />
      <TaglineMarquee />
      <CategoryShowcase />

      {carousel?.enabled && carouselProducts.length > 0 && (
        <LazySection minHeight="540px" rootMargin="80px" className="below-fold-section">
          <ArrivalsCarousel
            products={carouselProducts}
            eyebrow={carousel.subtitle}
            title={carousel.title}
            ctaLabel={carousel.cta_label}
            ctaHref={carousel.cta_href}
          />
        </LazySection>
      )}

      {arrivals?.enabled && arrivalProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-4">
                {arrivals.subtitle}
              </p>
              <h2 className="font-serif text-4xl sm:text-5xl tracking-tight">
                <RevealText>{arrivals.title}</RevealText>
              </h2>
            </div>
            <Link
              href={arrivals.cta_href}
              className="group flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase hover:opacity-60 transition-opacity"
            >
              {arrivals.cta_label}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6">
            {arrivalProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <LazySection minHeight="480px" rootMargin="80px">
        <BrandSection />
      </LazySection>
    </>
  );
}
