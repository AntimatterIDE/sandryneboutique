"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "shipped", label: "Shipped" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;

export function OrdersToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const status = searchParams.get("status") ?? "all";

  const push = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`/admin/orders${params.size ? `?${params}` : ""}`);
    });
  };

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
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
            placeholder="Search email or name…"
            className="rounded-none pl-9"
            aria-label="Search orders"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-none border border-foreground/15 px-4 text-[11px] tracking-[0.16em] uppercase hover:bg-foreground/5 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => push({ status: filter.value })}
            className={cn(
              "shrink-0 px-3 sm:px-4 py-1.5 border text-[11px] tracking-[0.14em] uppercase transition-colors",
              status === filter.value
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 hover:border-foreground"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
