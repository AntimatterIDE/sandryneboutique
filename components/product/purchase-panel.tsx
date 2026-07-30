"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TrustBadges } from "@/components/product/trust-badges";
import type { Product, ProductVariant } from "@/lib/types";
import { effectivePrice, formatPrice } from "@/lib/types";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

interface PurchasePanelProps {
  product: Product;
}

function activeVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((variant) => variant.active);
}

export function PurchasePanel({ product }: PurchasePanelProps) {
  const addItem = useCart((s) => s.addItem);
  const variants = activeVariants(product);

  const colors = useMemo(() => {
    const fromVariants = [
      ...new Set(variants.map((v) => v.color).filter((value): value is string => Boolean(value))),
    ];
    return fromVariants.length > 0 ? fromVariants : product.colors;
  }, [variants, product.colors]);

  const sizes = useMemo(() => {
    const fromVariants = [
      ...new Set(variants.map((v) => v.size).filter((value): value is string => Boolean(value))),
    ];
    return fromVariants.length > 0 ? fromVariants : product.sizes;
  }, [variants, product.sizes]);

  const [size, setSize] = useState<string | null>(sizes.length === 1 ? sizes[0] : null);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = useMemo(() => {
    if (variants.length === 0) return null;
    return (
      variants.find((variant) => {
        const sizeOk = !size || !variant.size || variant.size === size;
        const colorOk = !color || !variant.color || variant.color === color;
        const needsSize = sizes.length > 0;
        const needsColor = colors.length > 0;
        if (needsSize && variant.size !== size) return false;
        if (needsColor && variant.color !== color) return false;
        return sizeOk && colorOk;
      }) ?? null
    );
  }, [variants, size, color, sizes.length, colors.length]);

  const availableSizesForColor = useMemo(() => {
    if (!color || variants.length === 0) return new Set(sizes);
    return new Set(
      variants
        .filter((variant) => !variant.color || variant.color === color)
        .filter((variant) => variant.inventory_count > 0)
        .map((variant) => variant.size)
        .filter((value): value is string => Boolean(value))
    );
  }, [variants, color, sizes]);

  const availableColorsForSize = useMemo(() => {
    if (!size || variants.length === 0) return new Set(colors);
    return new Set(
      variants
        .filter((variant) => !variant.size || variant.size === size)
        .filter((variant) => variant.inventory_count > 0)
        .map((variant) => variant.color)
        .filter((value): value is string => Boolean(value))
    );
  }, [variants, size, colors]);

  const inventory = selectedVariant?.inventory_count ?? product.inventory_count;
  const unitPrice =
    selectedVariant != null
      ? product.on_sale && product.sale_price != null
        ? product.sale_price
        : selectedVariant.price || effectivePrice(product)
      : effectivePrice(product);

  // With variants: sold-out only after an exact size/color is chosen (or the
  // parent aggregate is already zero). Legacy products use product inventory.
  const soldOut =
    selectedVariant != null
      ? selectedVariant.inventory_count <= 0
      : product.inventory_count <= 0;
  const needsSize = sizes.length > 0 && !size;
  const needsColor = colors.length > 0 && !color;

  const handleAdd = () => {
    if (needsSize) {
      toast("Please select a size");
      return;
    }
    if (needsColor) {
      toast("Please select a color");
      return;
    }

    // Preferred path: exact Heartland size/color variant.
    if (variants.length > 0) {
      if (!selectedVariant) {
        toast("That size and color combination is unavailable");
        return;
      }
      if (selectedVariant.inventory_count <= 0) {
        toast("That size is sold out");
        return;
      }

      addItem(
        {
          productId: product.id,
          variantId: selectedVariant.id,
          slug: product.slug,
          name: product.name,
          price: unitPrice,
          image: product.images[0] ?? null,
          size: selectedVariant.size,
          color: selectedVariant.color,
          heartlandPublicId: selectedVariant.heartland_public_id,
          maxQuantity: selectedVariant.inventory_count,
        },
        quantity
      );
      return;
    }

    // Legacy products without variant rows yet.
    if (product.inventory_count <= 0) {
      toast("Sold out");
      return;
    }
    addItem(
      {
        productId: product.id,
        variantId: null,
        slug: product.slug,
        name: product.name,
        price: effectivePrice(product),
        image: product.images[0] ?? null,
        size,
        color,
        heartlandPublicId: product.heartland_public_id,
        maxQuantity: product.inventory_count,
      },
      quantity
    );
  };

  return (
    <div className="flex flex-col gap-7">
      {colors.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
              Color
            </span>
            {color && <span className="text-xs">{color}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const available = availableColorsForSize.has(c) || !size;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={!available && variants.length > 0}
                  onClick={() => setColor(c)}
                  className={cn(
                    "px-4 py-2.5 border text-xs transition-colors",
                    color === c
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/20 hover:border-foreground",
                    !available && variants.length > 0 && "opacity-30 line-through"
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
              Size
            </span>
            {size && <span className="text-xs">{size}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const available = availableSizesForColor.has(s) || !color;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!available && variants.length > 0}
                  onClick={() => setSize(s)}
                  className={cn(
                    "min-w-12 px-3 py-2.5 border text-xs transition-colors",
                    size === s
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/20 hover:border-foreground",
                    !available && variants.length > 0 && "opacity-30 line-through"
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedVariant && (
        <p className="text-sm tabular-nums -mt-3">
          {formatPrice(unitPrice)}
          {selectedVariant.inventory_count > 0 && selectedVariant.inventory_count <= 5 && (
            <span className="ml-3 text-xs text-destructive">
              Only {selectedVariant.inventory_count} left
            </span>
          )}
        </p>
      )}

      <div className="flex items-stretch gap-3">
        <div className="flex items-center border border-foreground/20">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3.5 hover:bg-muted transition-colors h-full"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center text-sm tabular-nums">{quantity}</span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(Math.max(inventory, 1), q + 1))}
            className="px-3.5 hover:bg-muted transition-colors h-full"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <Button
          onClick={handleAdd}
          disabled={soldOut}
          className="flex-1 rounded-none h-12 tracking-[0.22em] uppercase text-xs"
        >
          {soldOut ? "Sold Out" : "Add to Cart"}
        </Button>
      </div>

      {!soldOut && inventory > 0 && inventory <= 5 && !selectedVariant && (
        <p className="text-xs text-destructive -mt-3">Only {inventory} left in stock</p>
      )}

      <TrustBadges className="-mt-2" />
    </div>
  );
}
