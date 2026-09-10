"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { updateHomepageSection } from "@/app/admin/actions";
import { HeroImageField } from "@/components/admin/hero-image-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_TILE_SLOTS } from "@/lib/homepage-defaults";
import type { HomepageSection, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryTilesFormProps {
  sections: HomepageSection[];
  products: Product[];
}

type SlotId = (typeof CATEGORY_TILE_SLOTS)[number]["id"];

export function CategoryTilesForm({ sections, products }: CategoryTilesFormProps) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [productIds, setProductIds] = useState<Record<SlotId, string>>(() => {
    const next = {} as Record<SlotId, string>;
    for (const slot of CATEGORY_TILE_SLOTS) {
      const section = sections.find((row) => row.id === slot.id);
      next[slot.id] = section?.product_ids?.[0] ?? "";
    }
    return next;
  });
  const [imageUrls, setImageUrls] = useState<Record<SlotId, string>>(() => {
    const next = {} as Record<SlotId, string>;
    for (const slot of CATEGORY_TILE_SLOTS) {
      const section = sections.find((row) => row.id === slot.id);
      next[slot.id] = section?.image_url ?? "";
    }
    return next;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shoppable = products.filter((p) => p.images.length > 0);
    if (!q) return shoppable;
    return shoppable.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, query]);

  const save = () => {
    startTransition(async () => {
      for (const slot of CATEGORY_TILE_SLOTS) {
        const section = sections.find((row) => row.id === slot.id);
        const picked = productIds[slot.id];
        const result = await updateHomepageSection(slot.id, {
          title: section?.title ?? slot.label,
          subtitle: section?.subtitle ?? "Shop by Category",
          cta_label: section?.cta_label ?? "Shop now",
          cta_href: section?.cta_href ?? slot.href,
          product_ids: picked ? [picked] : [],
          max_items: 1,
          enabled: true,
          image_url: imageUrls[slot.id],
        });
        if (!result.ok) {
          toast.error(`${slot.label}: ${result.message}`);
          return;
        }
      }
      toast.success("Category photos saved.");
    });
  };

  return (
    <section className="border border-foreground/10 p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
          Shop by category
        </p>
        <h2 className="font-serif text-2xl tracking-tight mt-1">Category photos</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          These three tiles sit under the homepage headline. Pick a women&apos;s
          product from the catalog so the photo matches what you sell, or upload
          your own image. Empty slots use the newest in-stock item in that
          category.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        {CATEGORY_TILE_SLOTS.map((slot) => {
          const pickedId = productIds[slot.id];
          const picked = products.find((p) => p.id === pickedId);
          const list = query.trim()
            ? filtered
            : products.filter((p) => p.category === slot.slug && p.images.length > 0);

          return (
            <div key={slot.id} className="space-y-3">
              <div>
                <p className="font-serif text-xl">{slot.label}</p>
                <p className="text-xs text-muted-foreground">
                  Links to {slot.href}
                </p>
              </div>

              <HeroImageField
                value={imageUrls[slot.id]}
                onChange={(url) =>
                  setImageUrls((current) => ({ ...current, [slot.id]: url }))
                }
                buttonLabel="Upload photo"
              />

              {picked ? (
                <div className="flex items-center gap-3 border border-foreground/10 p-2">
                  <div className="relative size-12 bg-muted shrink-0 overflow-hidden">
                    {picked.images[0] ? (
                      <Image
                        src={picked.images[0]}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{picked.name}</p>
                    <p className="text-[11px] text-muted-foreground">Using this product photo</p>
                  </div>
                  <button
                    type="button"
                    className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
                    onClick={() =>
                      setProductIds((current) => ({ ...current, [slot.id]: "" }))
                    }
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No product selected — the homepage will use a live {slot.label.toLowerCase()}{" "}
                  photo from the catalog.
                </p>
              )}

              <div className="max-h-56 overflow-y-auto border border-foreground/8 divide-y divide-foreground/6">
                {list.slice(0, 40).map((product) => {
                  const selected = product.id === pickedId;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() =>
                        setProductIds((current) => ({
                          ...current,
                          [slot.id]: selected ? "" : product.id,
                        }))
                      }
                      aria-pressed={selected}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        selected ? "bg-foreground text-background" : "hover:bg-muted/60"
                      )}
                    >
                      <div className="relative size-9 bg-muted shrink-0 overflow-hidden">
                        {product.images[0] ? (
                          <Image
                            src={product.images[0]}
                            alt=""
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <span className="flex-1 truncate">{product.name}</span>
                      {selected ? <Check className="size-3.5 shrink-0" /> : null}
                    </button>
                  );
                })}
                {list.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No matching products.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any product to use as a category photo…"
          className="rounded-none pl-9"
        />
      </div>

      <Button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-none tracking-[0.16em] uppercase text-xs h-11 px-8"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Save category photos"}
      </Button>
    </section>
  );
}
