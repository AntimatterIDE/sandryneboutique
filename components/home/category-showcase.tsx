import Image from "next/image";
import Link from "next/link";
import type { CategoryShowcaseTile } from "@/lib/data/homepage";

interface CategoryShowcaseProps {
  tiles: CategoryShowcaseTile[];
}

export function CategoryShowcase({ tiles }: CategoryShowcaseProps) {
  const bySlug = new Map(tiles.map((tile) => [tile.slug, tile]));
  const bottoms = bySlug.get("bottoms");
  const dresses = bySlug.get("dresses");
  const tops = bySlug.get("tops");

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28 below-fold-section">
      <div className="mb-12 sm:mb-16 max-w-3xl">
        <h2 className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-5">
          Shop by Category
        </h2>
        <p className="font-serif text-3xl sm:text-5xl leading-[1.15] tracking-tight">
          Tailored{" "}
          <Link
            href={bottoms?.href ?? "/shop?category=bottoms"}
            className="italic underline decoration-1 underline-offset-8 decoration-foreground/30 hover:decoration-foreground transition-colors"
          >
            bottoms
          </Link>
          , fluid{" "}
          <Link
            href={dresses?.href ?? "/shop?category=dresses"}
            className="italic underline decoration-1 underline-offset-8 decoration-foreground/30 hover:decoration-foreground transition-colors"
          >
            dresses
          </Link>
          , and crisp{" "}
          <Link
            href={tops?.href ?? "/shop?category=tops"}
            className="italic underline decoration-1 underline-offset-8 decoration-foreground/30 hover:decoration-foreground transition-colors"
          >
            tops
          </Link>{" "}
          — every piece chosen to live together, effortlessly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {tiles.map((tile) => (
          <Link
            key={tile.slug}
            href={tile.href}
            className="group block relative overflow-hidden"
          >
            <div className="relative aspect-3/4 bg-muted">
              <Image
                src={tile.image}
                alt={tile.label}
                fill
                loading="lazy"
                fetchPriority="low"
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            </div>
            <div className="absolute bottom-0 inset-x-0 p-6 flex items-end justify-between">
              <h3 className="font-serif text-2xl sm:text-3xl text-white tracking-wide">
                {tile.label}
              </h3>
              <span className="text-[10px] tracking-[0.22em] uppercase text-white/80 group-hover:text-white transition-colors">
                Shop now
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
