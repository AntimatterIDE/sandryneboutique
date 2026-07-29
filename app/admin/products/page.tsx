import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { ProductsToolbar } from "@/components/admin/products-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogPagination } from "@/components/ui/catalog-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import type { Product } from "@/lib/types";
import { effectivePrice, formatPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Products",
};

const ADMIN_PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function adminHref(params: {
  q?: string | null;
  category?: string | null;
  stock?: string | null;
  image?: string | null;
  page?: number;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category && params.category !== "all") sp.set("category", params.category);
  if (params.stock && params.stock !== "all") sp.set("stock", params.stock);
  if (params.image && params.image !== "all") sp.set("image", params.image);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

function ProductBadges({ product }: { product: Product }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {product.images.length === 0 && (
        <Badge variant="outline" className="rounded-none text-[10px] uppercase">
          No photo
        </Badge>
      )}
      {product.is_new && (
        <Badge variant="secondary" className="rounded-none text-[10px] uppercase">
          New
        </Badge>
      )}
      {product.on_sale && (
        <Badge className="rounded-none text-[10px] uppercase">Sale</Badge>
      )}
      {product.inventory_count === 0 && (
        <Badge variant="destructive" className="rounded-none text-[10px] uppercase">
          Out
        </Badge>
      )}
    </div>
  );
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = first(sp.q)?.trim() ?? "";
  const category = first(sp.category) ?? "all";
  const stock = first(sp.stock) ?? "all";
  const image = first(sp.image) ?? "all";
  const page = Math.max(1, Number(first(sp.page) ?? "1") || 1);

  let products: Product[] = [];
  let total = 0;

  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (q) {
      const term = q.replace(/[%_,]/g, "");
      const searchFilters = [
        `name.ilike.%${term}%`,
        `slug.ilike.%${term}%`,
        `heartland_public_id.ilike.%${term}%`,
      ];
      if (/^\d+$/.test(term)) {
        searchFilters.push(`heartland_item_id.eq.${Number(term)}`);
      }
      query = query.or(searchFilters.join(","));
    }
    if (category !== "all") query = query.eq("category", category);
    if (stock === "in") query = query.gt("inventory_count", 0);
    if (stock === "low") query = query.lte("inventory_count", 5);
    if (stock === "out") query = query.eq("inventory_count", 0);
    if (image === "has") query = query.not("images", "eq", "{}");
    if (image === "none") query = query.eq("images", "{}");

    const from = (page - 1) * ADMIN_PAGE_SIZE;
    const to = from + ADMIN_PAGE_SIZE - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) console.error("Admin product query failed:", error);
    products = (data ?? []) as Product[];
    total = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} {total === 1 ? "product" : "products"}
            {q || category !== "all" || stock !== "all" || image !== "all"
              ? " matching filters"
              : " in the catalog"}.
          </p>
        </div>
        <Button asChild className="rounded-none tracking-[0.16em] uppercase text-xs gap-2 w-full sm:w-auto">
          <Link href="/admin/products/new">
            <Plus className="size-4" />
            New Product
          </Link>
        </Button>
      </header>

      <Suspense>
        <ProductsToolbar />
      </Suspense>

      {products.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-foreground/15">
          <p className="font-serif text-2xl mb-2">No products found</p>
          <p className="text-sm text-muted-foreground">Try different filters or add a new product.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="md:hidden space-y-3">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex gap-3 border border-foreground/10 p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="relative w-16 h-20 bg-muted shrink-0 overflow-hidden">
                    {product.images[0] && (
                      <Image
                        src={product.images[0]}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-medium leading-snug">{product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Item # {product.heartland_public_id ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {product.category.replace("-", " & ")} ·{" "}
                      <span
                        className={cn(
                          "tabular-nums",
                          product.inventory_count === 0 && "text-destructive",
                          product.inventory_count > 0 &&
                            product.inventory_count <= 5 &&
                            "text-amber-600"
                        )}
                      >
                        {product.inventory_count} in stock
                      </span>
                    </p>
                    <p className="text-sm tabular-nums">{formatPrice(effectivePrice(product))}</p>
                    <ProductBadges product={product} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block border border-foreground/10 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16" />
                  <TableHead>Name</TableHead>
                  <TableHead>Item #</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Inventory</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link href={`/admin/products/${product.id}`}>
                        <div className="relative w-10 h-13 bg-muted overflow-hidden">
                          {product.images[0] && (
                            <Image
                              src={product.images[0]}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="font-medium hover:underline underline-offset-4"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">{product.slug}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {product.heartland_public_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {product.category.replace("-", " & ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(effectivePrice(product))}
                      {product.on_sale && (
                        <span className="block text-xs text-muted-foreground line-through">
                          {formatPrice(product.price)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        product.inventory_count === 0 && "text-destructive",
                        product.inventory_count > 0 &&
                          product.inventory_count <= 5 &&
                          "text-amber-600"
                      )}
                    >
                      {product.inventory_count}
                    </TableCell>
                    <TableCell>
                      <ProductBadges product={product} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <CatalogPagination
        page={Math.min(page, totalPages)}
        totalPages={totalPages}
        hrefForPage={(p) =>
          adminHref({
            q: q || null,
            category,
            stock,
            image,
            page: p,
          })
        }
        className="pt-2"
      />
    </div>
  );
}
