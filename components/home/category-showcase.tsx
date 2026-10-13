import Image from "next/image";
import Link from "next/link";
import type { CategoryShowcaseTile } from "@/lib/data/homepage";

interface CategoryShowcaseProps {
  tiles: CategoryShowcaseTile[];
  eyebrow?: string;
  intro?: string;
  showIntro?: boolean;
}

function withCategoryLinks(text: string, tiles: CategoryShowcaseTile[]) {
  const byWord = new Map(tiles.map((tile) => [tile.slug, tile]));
  const parts = text.split(/\b(bottoms|dresses|tops)\b/i);
  return parts.map((part, index) => {
    const tile = byWord.get(part.toLowerCase() as CategoryShowcaseTile["slug"]);
    if (!tile) return <span key={index}>{part}</span>;
    return (
      <Link
        key={index}
        href={tile.href}
        className="italic underline decoration-1 underline-offset-8 decoration-foreground/30 hover:decoration-foreground transition-colors"
      >
        {part}
      </Link>
    );
  });
}

export function CategoryShowcase({ tiles, eyebrow, intro, showIntro = true }: CategoryShowcaseProps) {
  const heading = eyebrow?.trim() || "Shop by Category";
  const sentence =
    intro?.trim() ||
    "Tailored bottoms, fluid dresses, and crisp tops — every piece chosen to live together, effortlessly.";

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28 below-fold-section">
      {showIntro && (
      <div className="mb-12 sm:mb-16 max-w-3xl">
        <h2 className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-5">
          {heading}
        </h2>
        <p className="font-serif text-3xl sm:text-5xl leading-[1.15] tracking-tight">
          {withCategoryLinks(sentence, tiles)}
        </p>
      </div>
      )}

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
