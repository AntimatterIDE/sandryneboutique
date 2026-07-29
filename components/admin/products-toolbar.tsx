"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants";

const DB_CATEGORIES = CATEGORIES.filter((c) => c.dbCategory);

export function ProductsToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const category = searchParams.get("category") ?? "all";
  const stock = searchParams.get("stock") ?? "all";
  const image = searchParams.get("image") ?? "all";

  const push = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => {
      router.replace(`/admin/products${params.size ? `?${params}` : ""}`);
    });
  };

  return (
    <form
      className="flex flex-col sm:flex-row gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        push({ q: q.trim() || null });
      }}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, slug, Item # or internal ID…"
          className="rounded-none pl-9"
          aria-label="Search products by name, slug, Heartland Item number, or internal ID"
        />
      </div>

      <Select value={category} onValueChange={(v) => push({ category: v })}>
        <SelectTrigger className="rounded-none w-full sm:w-44" aria-label="Filter by category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {DB_CATEGORIES.map((c) => (
            <SelectItem key={c.dbCategory!} value={c.dbCategory!}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={stock} onValueChange={(v) => push({ stock: v })}>
        <SelectTrigger className="rounded-none w-full sm:w-40" aria-label="Filter by stock">
          <SelectValue placeholder="Stock" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All stock</SelectItem>
          <SelectItem value="in">In stock</SelectItem>
          <SelectItem value="low">Low stock (≤5)</SelectItem>
          <SelectItem value="out">Out of stock</SelectItem>
        </SelectContent>
      </Select>

      <Select value={image} onValueChange={(v) => push({ image: v })}>
        <SelectTrigger className="rounded-none w-full sm:w-40" aria-label="Filter by images">
          <SelectValue placeholder="Images" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All images</SelectItem>
          <SelectItem value="has">Has image(s)</SelectItem>
          <SelectItem value="none">No image</SelectItem>
        </SelectContent>
      </Select>

      <button
        type="submit"
        className="rounded-none border border-foreground/15 px-4 text-[11px] tracking-[0.16em] uppercase hover:bg-foreground/5 transition-colors disabled:opacity-50"
        disabled={pending}
      >
        Search
      </button>
    </form>
  );
}
