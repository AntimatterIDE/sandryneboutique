"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  updateHomepageSection,
  type HomepageSectionInput,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { HeroImageField } from "@/components/admin/hero-image-field";
import type { HomepageSection, Product } from "@/lib/types";
import { formatPrice, effectivePrice } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HomepageSectionFormProps {
  section: HomepageSection;
  products: Product[];
}

export function HomepageSectionForm({ section, products }: HomepageSectionFormProps) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle);
  const [ctaLabel, setCtaLabel] = useState(section.cta_label);
  const [ctaHref, setCtaHref] = useState(section.cta_href);
  const [maxItems, setMaxItems] = useState(section.max_items);
  const [enabled, setEnabled] = useState(section.enabled);
  const [productIds, setProductIds] = useState<string[]>(section.product_ids);
  const [imageUrl, setImageUrl] = useState(section.image_url ?? "");
  const [query, setQuery] = useState("");
  const isHero = section.id === "hero";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, query]);

  const selectedProducts = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));

  const toggleProduct = (id: string) => {
    setProductIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxItems) {
        toast.error(`This section shows at most ${maxItems} products.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const moveSelected = (id: string, direction: -1 | 1) => {
    setProductIds((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + direction;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const save = () => {
    const input: HomepageSectionInput = {
      title,
      subtitle,
      cta_label: ctaLabel,
      cta_href: ctaHref,
      product_ids: isHero ? [] : productIds,
      max_items: isHero ? 8 : maxItems,
      enabled,
      image_url: imageUrl,
    };

    startTransition(async () => {
      const result = await updateHomepageSection(section.id, input);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <section className="border border-foreground/10 p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
            {section.label}
          </p>
          <h2 className="font-serif text-2xl tracking-tight mt-1">{section.title}</h2>
        </div>
        {!isHero && (
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Visible on homepage
          </label>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${section.id}-title`}>Title</Label>
          <Input
            id={`${section.id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${section.id}-subtitle`}>Eyebrow / subtitle</Label>
          <Input
            id={`${section.id}-subtitle`}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${section.id}-cta-label`}>CTA label</Label>
          <Input
            id={`${section.id}-cta-label`}
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${section.id}-cta-href`}>CTA link</Label>
          <Input
            id={`${section.id}-cta-href`}
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            className="rounded-none font-mono text-sm"
            placeholder="/shop?category=tops"
          />
        </div>
        {!isHero && (
          <div className="space-y-2">
            <Label htmlFor={`${section.id}-max`}>Max products</Label>
            <Input
              id={`${section.id}-max`}
              type="number"
              min={1}
              max={24}
              value={maxItems}
              onChange={(e) => setMaxItems(Number(e.target.value) || 8)}
              className="rounded-none w-28"
            />
          </div>
        )}
      </div>

      {isHero && (
        <div className="space-y-2">
          <Label>Hero image</Label>
          <p className="text-xs text-muted-foreground">
            This photo appears on the right side of the homepage hero. Upload a new
            file or paste a URL, then save.
          </p>
          <HeroImageField value={imageUrl} onChange={setImageUrl} />
        </div>
      )}

      {!isHero && (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Label>Featured products ({productIds.length}/{maxItems})</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to auto-fill from the catalog (newest / new arrivals).
              Selected order is the display order.
            </p>
          </div>
          {productIds.length > 0 && (
            <button
              type="button"
              onClick={() => setProductIds([])}
              className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          )}
        </div>

        {selectedProducts.length > 0 && (
          <ol className="flex flex-col gap-2 border border-foreground/8 p-3">
            {selectedProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="tabular-nums text-muted-foreground w-5">{i + 1}.</span>
                <div className="relative size-10 bg-muted shrink-0 overflow-hidden">
                  {p.images[0] && (
                    <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPrice(effectivePrice(p))}
                    {p.inventory_count === 0 && " · out of stock"}
                    {p.images.length === 0 && " · no image"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border border-foreground/15"
                    onClick={() => moveSelected(p.id, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border border-foreground/15"
                    onClick={() => moveSelected(p.id, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs border border-foreground/15"
                    onClick={() => toggleProduct(p.id)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search catalog to add products…"
            className="rounded-none pl-9"
          />
        </div>

        <div className="max-h-72 overflow-y-auto border border-foreground/8 divide-y divide-foreground/6">
          {filtered.slice(0, 80).map((product) => {
            const selected = productIds.includes(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => toggleProduct(product.id)}
                aria-pressed={selected}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                  selected ? "bg-foreground text-background" : "hover:bg-muted/60"
                )}
              >
                <div className="relative size-9 bg-muted shrink-0 overflow-hidden">
                  {product.images[0] && (
                    <Image
                      src={product.images[0]}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  )}
                </div>
                <span className="flex-1 truncate">{product.name}</span>
                {selected && <Check className="size-3.5 shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No products match.</p>
          )}
        </div>
      </div>
      )}

      <div className="pt-2">
        <Button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-none tracking-[0.16em] uppercase text-xs h-11 px-8"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isHero ? (
            "Save hero"
          ) : (
            "Save section"
          )}
        </Button>
      </div>
    </section>
  );
}
