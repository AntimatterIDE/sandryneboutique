"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants";
import { shopHref } from "@/lib/shop";
import { formatPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  availableSizes: string[];
  availableColors: string[];
  maxCatalogPrice: number;
  resultCount: number;
  activeCategory?: string | null;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

export function FilterBar({
  availableSizes,
  availableColors,
  maxCatalogPrice,
  resultCount,
  activeCategory = null,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);

  const currentQuery = searchParams.get("q");
  const currentSort = searchParams.get("sort") ?? "newest";
  const currentSize = searchParams.get("size");
  const currentColor = searchParams.get("color");
  const currentCategory = searchParams.get("category") ?? activeCategory;
  const currentMax = Number(searchParams.get("max") ?? maxCatalogPrice);

  const [pendingMax, setPendingMax] = useState(currentMax);

  const navigate = useCallback(
    (patch: {
      q?: string | null;
      category?: string | null;
      size?: string | null;
      color?: string | null;
      sort?: string | null;
      max?: string | null;
    }) => {
      const nextQuery = patch.q === undefined ? currentQuery : patch.q;
      const nextCategory =
        patch.category === undefined ? currentCategory : patch.category;
      const nextSize = patch.size === undefined ? currentSize : patch.size;
      const nextColor = patch.color === undefined ? currentColor : patch.color;
      const nextSort =
        patch.sort === undefined
          ? currentSort === "newest"
            ? null
            : currentSort
          : patch.sort;
      const nextMax =
        patch.max === undefined
          ? searchParams.get("max")
          : patch.max;

      router.replace(
        shopHref({
          q: nextQuery,
          category: nextCategory,
          size: nextSize,
          color: nextColor,
          sort: nextSort,
          max: nextMax,
          page: 1,
        }),
        { scroll: false }
      );
    },
    [
      router,
      currentQuery,
      currentCategory,
      currentSize,
      currentColor,
      currentSort,
      searchParams,
    ]
  );

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];
    if (currentQuery) filters.push({ key: "q", label: `Search: “${currentQuery}”` });
    if (currentCategory) {
      const label =
        CATEGORIES.find((c) => c.slug === currentCategory)?.label ?? currentCategory;
      filters.push({ key: "category", label });
    }
    if (currentSize) filters.push({ key: "size", label: `Size ${currentSize}` });
    if (currentColor) filters.push({ key: "color", label: currentColor });
    if (searchParams.get("max")) {
      filters.push({ key: "max", label: `Under ${formatPrice(currentMax)}` });
    }
    return filters;
  }, [currentQuery, currentCategory, currentSize, currentColor, currentMax, searchParams]);

  const clearAll = () => {
    router.replace("/shop", { scroll: false });
    setPendingMax(maxCatalogPrice);
  };

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex w-full max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const query = String(form.get("q") ?? "").trim();
          navigate({ q: query || null });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            key={currentQuery ?? ""}
            name="q"
            type="search"
            defaultValue={currentQuery ?? ""}
            placeholder="Search products, Heartland Item # or ID…"
            aria-label="Search products by name, Heartland Item number, or internal ID"
            className="h-11 rounded-none border-r-0 pl-10"
          />
        </div>
        <Button
          type="submit"
          className="h-11 rounded-none px-5 text-[11px] tracking-[0.16em] uppercase"
        >
          Search
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2 pb-1 -mx-1 px-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => navigate({ category: null })}
          className={cn(
            "shrink-0 px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase border transition-colors",
            !currentCategory
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/15 hover:border-foreground/40"
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() =>
              navigate({
                category: currentCategory === cat.slug ? null : cat.slug,
              })
            }
            className={cn(
              "shrink-0 px-3 py-1.5 text-[11px] tracking-[0.16em] uppercase border transition-colors",
              currentCategory === cat.slug
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 hover:border-foreground/40"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none text-[11px] tracking-[0.18em] uppercase gap-2"
              >
                <SlidersHorizontal className="size-3.5" />
                Filter
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:max-w-sm p-0 flex flex-col">
              <SheetHeader className="px-6 py-5 border-b border-foreground/8">
                <SheetTitle className="font-serif text-xl tracking-[0.18em] uppercase font-normal">
                  Filter
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                {availableSizes.length > 0 && (
                  <div>
                    <h3 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Size
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() =>
                            navigate({ size: currentSize === size ? null : size })
                          }
                          className={cn(
                            "min-w-11 px-3 py-2 border text-xs transition-colors",
                            currentSize === size
                              ? "border-foreground bg-foreground text-background"
                              : "border-foreground/20 hover:border-foreground"
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableColors.length > 0 && (
                  <div>
                    <h3 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Color
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            navigate({ color: currentColor === color ? null : color })
                          }
                          className={cn(
                            "px-3 py-2 border text-xs transition-colors",
                            currentColor === color
                              ? "border-foreground bg-foreground text-background"
                              : "border-foreground/20 hover:border-foreground"
                          )}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
                    Max price — {formatPrice(pendingMax)}
                  </h3>
                  <Slider
                    min={0}
                    max={maxCatalogPrice || 100}
                    step={5}
                    value={[pendingMax]}
                    onValueChange={([v]) => setPendingMax(v)}
                    onValueCommit={([v]) =>
                      navigate({
                        max: v >= maxCatalogPrice ? null : String(v),
                      })
                    }
                  />
                </div>
              </div>

              <SheetFooter className="px-6 py-5 border-t border-foreground/8 flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-none text-[11px] tracking-[0.18em] uppercase"
                  onClick={clearAll}
                >
                  Clear all
                </Button>
                <Button
                  className="flex-1 rounded-none text-[11px] tracking-[0.18em] uppercase"
                  onClick={() => setSheetOpen(false)}
                >
                  View {resultCount} {resultCount === 1 ? "item" : "items"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <span className="text-xs text-muted-foreground hidden sm:inline">
            {resultCount} {resultCount === 1 ? "item" : "items"}
          </span>
        </div>

        <Select
          value={currentSort}
          onValueChange={(v) => navigate({ sort: v === "newest" ? null : v })}
        >
          <SelectTrigger
            size="sm"
            className="rounded-none text-[11px] tracking-[0.18em] uppercase w-auto min-w-44"
          >
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="rounded-none gap-1.5 pr-1.5 text-[11px] font-normal"
            >
              {filter.label}
              <button
                type="button"
                aria-label={`Remove ${filter.label} filter`}
                onClick={() => navigate({ [filter.key]: null })}
                className="hover:opacity-60"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
