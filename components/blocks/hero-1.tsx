import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuroraVeil } from "@/components/react-bits/aurora-veil";
import Magnetic from "@/components/react-bits/magnetic";
import { DEFAULT_HERO_IMAGE } from "@/lib/homepage-defaults";

interface Hero1Props {
  imageUrl?: string | null;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
}

function splitHeroTitle(title: string): { lead: string; rest: string | null } {
  const comma = title.indexOf(",");
  if (comma === -1) return { lead: title, rest: null };
  return { lead: title.slice(0, comma + 1), rest: title.slice(comma + 1).trim() };
}

export function Hero1({ imageUrl, title, subtitle, ctaLabel, ctaHref }: Hero1Props) {
  const src = imageUrl?.trim() || DEFAULT_HERO_IMAGE;
  const heading = title?.trim() || "Summer, Elevated.";
  const { lead, rest } = splitHeroTitle(heading);
  const eyebrow = subtitle?.trim() || "The Summer '26 Edit";
  const primaryLabel = ctaLabel?.trim() || "Explore Summer Collection";
  const primaryHref = ctaHref?.trim() || "/shop?category=new-arrivals";
  return (
    <section className="relative isolate w-full flex items-start lg:items-center py-10 sm:py-14 px-4 sm:px-6 lg:px-8 bg-background">
      <AuroraVeil />
      <div className="max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">
          <div className="flex flex-col space-y-6 sm:space-y-8">
            <div className="hero-fade-up flex items-center gap-3 w-fit">
              <span className="inline-flex items-center px-3 py-1 bg-foreground text-background text-[10px] tracking-[0.24em] uppercase">
                New Arrivals
              </span>
              <span className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground">
                {eyebrow}
              </span>
            </div>

            <h1 className="hero-fade-up font-sans sm:font-serif text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] tracking-tight leading-[1.02] text-foreground">
              {rest ? (
                <>
                  {lead}
                  <br />
                  <em className="italic font-light">{rest}</em>
                </>
              ) : (
                heading
              )}
            </h1>

            <p className="hero-fade-up text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg">
              Silk dresses, elevated essentials, and gold vermeil jewelry —
              curated in limited runs for women who dress with intention.
              New pieces land weekly, and the best sell out first.
            </p>

            <div className="hero-fade-up hero-delay-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <Magnetic className="w-full sm:w-auto">
                <Link
                  href={primaryHref}
                  className="relative overflow-hidden flex items-center justify-center px-8 py-3.5 bg-foreground text-background text-[11px] tracking-[0.22em] uppercase hover:bg-foreground/85 transition-colors w-full"
                >
                  {primaryLabel}
                </Link>
              </Magnetic>
              <Magnetic className="w-full sm:w-auto">
                <Link
                  href="/shop?category=sale"
                  className="flex items-center justify-center gap-2 px-8 py-3.5 border border-foreground/20 text-[11px] tracking-[0.22em] uppercase hover:bg-foreground/5 transition-colors w-full group"
                >
                  Shop the Sale
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Magnetic>
            </div>

            <div className="hero-fade-up hero-delay-4 flex items-center gap-4 pt-2 sm:pt-4">
              <div className="h-px w-12 bg-foreground/30 shrink-0" aria-hidden />
              <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                Free shipping over $200 · Secure checkout · 14-day easy returns
              </p>
            </div>
          </div>

          <div className="hero-fade-up hero-delay-2 relative w-full h-auto hidden sm:block">
            <div className="relative w-full min-h-[360px] sm:min-h-[560px] lg:min-h-[640px] bg-muted overflow-hidden">
              <Image
                src={src}
                alt={`${heading} — Sandryne Boutique`}
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 1024px) 100vw, 50vw"
                quality={75}
                className="object-cover"
              />

              <div className="absolute bottom-0 right-0 flex flex-col items-end">
                <svg width="40" height="40" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M0 200C155.996 199.961 200.029 156.308 200 0V200H0Z" className="fill-background" />
                </svg>
                <div className="relative">
                  <div className="w-24 h-24 bg-background pl-4 pt-4">
                    <Magnetic className="w-full h-full" maxOffset={5}>
                      <Link
                        href="/shop?category=dresses"
                        aria-label="Shop dresses"
                        className="w-full h-full flex items-center justify-center bg-foreground hover:opacity-90 transition-opacity"
                      >
                        <ArrowRight className="w-6 h-6 text-background -rotate-45" />
                      </Link>
                    </Magnetic>
                  </div>
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 200 200"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute bottom-0 -left-10"
                    aria-hidden
                  >
                    <path d="M0 200C155.996 199.961 200.029 156.308 200 0V200H0Z" className="fill-background" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
