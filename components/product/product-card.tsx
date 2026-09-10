import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { effectivePrice, formatPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  className?: string;
}

export function ProductCard({ product, priority = false, className }: ProductCardProps) {
  const price = effectivePrice(product);
  const hasHoverImage = product.images.length > 1;
  const soldOut = product.inventory_count <= 0;

  return (
    <article className={cn("group", className)}>
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-3/4 overflow-hidden bg-muted">
          {product.images[0] && (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                "object-cover transition-all duration-700 ease-out group-hover:scale-[1.04]",
                hasHoverImage && "group-hover:opacity-0",
              )}
            />
          )}
          {hasHoverImage && (
            <Image
              src={product.images[1]}
              alt={`${product.name} — alternate view`}
              fill
              loading="lazy"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover opacity-0 scale-[1.04] transition-all duration-700 ease-out group-hover:opacity-100"
            />
          )}

          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.is_new && (
              <span className="bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase">
                New
              </span>
            )}
            {product.on_sale && (
              <span className="bg-foreground text-background px-2.5 py-1 text-[10px] tracking-[0.2em] uppercase">
                Sale
              </span>
            )}
          </div>

          {soldOut && (
            <div className="absolute inset-x-0 bottom-0 bg-background/85 backdrop-blur py-2 text-center text-[10px] tracking-[0.22em] uppercase">
              Sold Out
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <h3 className="text-sm leading-snug">{product.name}</h3>
          <div className="flex items-baseline gap-2 text-sm">
            <span className={cn("tabular-nums", product.on_sale && "text-destructive")}>
              {formatPrice(price)}
            </span>
            {product.on_sale && (
              <span className="text-muted-foreground line-through tabular-nums text-xs">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
          {product.on_sale ? (
            <p className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
              Final sale
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
