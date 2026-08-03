import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { ensureProductFromHeartland } from "@/app/admin/actions";
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
import { looksLikeHeartlandItemQuery } from "@/lib/heartland-retail";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/data/categories";
import {
  getVariantsByProductIds,
  productIdsMatchingVariantSearch,
  productSearchFilters,
  supabaseConfigured,
} from "@/lib/data/products";
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

/** Primary Item #, plus a count of the remaining size/color variants. */
function itemNumberLabel(product: Product): string {
  const numbers = (product.variants ?? [])
    .map((variant) => variant.heartland_public_id)
    .filter(Boolean);

  if (numbers.length === 0) {
    return product.heartland_public_id ?? "—";
  }
  if (numbers.length === 1) return numbers[0];
  return `${numbers[0]} +${numbers.length - 1}`;
}

function variantCountLabel(product: Product): string | null {
  const count = product.variants?.length ?? 0;
  if (count <= 1) return null;
  return `${count} variants`;
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
  const categoryTree = await getCategoryTree();
  const toolbarCategories = categoryTree.flatMap((parent) => [
    { slug: parent.slug, label: parent.name },
    ...parent.children.map((child) => ({
      slug: child.slug,
      label: `${parent.name} / ${child.name}`,
    })),
  ]);
  const selectedIsSubcategory = categoryTree.some((parent) =>
    parent.children.some((child) => child.slug === category)
  );

  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    let query = supabase
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (q) {
      const variantProductIds = await productIdsMatchingVariantSearch(q);
      const searchFilters = productSearchFilters(q, variantProductIds);
      if (searchFilters.length > 0) query = query.or(searchFilters.join(","));
    }
    if (category !== "all") {
      query = selectedIsSubcategory
        ? query.eq("subcategory", category)
        : query.eq("category", category);
    }
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

    if (products.length > 0) {
      const variantsByProduct = await getVariantsByProductIds(products.map((p) => p.id));
      products = products.map((product) => ({
        ...product,
        variants: variantsByProduct.get(product.id) ?? [],
      }));
    }
  }

  // Heartland Item # search: import/refresh product with live inventory, open editor.
  // Must not revalidatePath during this render — that crashes the RSC.
  let heartlandImportError: string | null = null;
  let heartlandRedirectId: string | null = null;
  if (
    q &&
    page === 1 &&
    category === "all" &&
    stock === "all" &&
    image === "all" &&
    looksLikeHeartlandItemQuery(q)
  ) {
    try {
      const ensured = await ensureProductFromHeartland(q);
      if (ensured.ok && ensured.id) {
        heartlandRedirectId = ensured.id;
      } else if (products.length === 0) {
        heartlandImportError = ensured.message;
      }
    } catch (err) {
      console.error("Heartland Item # import failed:", err);
      if (products.length === 0) {
        heartlandImportError =
          err instanceof Error
            ? err.message
            : "Could not import that Item # from Heartland.";
      }
    }
  }

  if (heartlandRedirectId) {
    redirect(`/admin/products/${heartlandRedirectId}`);
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
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row">
          <Button
            asChild
            variant="outline"
            className="rounded-none tracking-[0.16em] uppercase text-xs gap-2"
          >
            <Link href="/admin/categories">Categories</Link>
          </Button>
          <Button asChild className="rounded-none tracking-[0.16em] uppercase text-xs gap-2">
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              New Product
            </Link>
          </Button>
        </div>
      </header>

      <Suspense>
        <ProductsToolbar categories={toolbarCategories} />
      </Suspense>

      {heartlandImportError && (
        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {heartlandImportError}
        </div>
      )}

      {products.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-foreground/15">
          <p className="font-serif text-2xl mb-2">No products found</p>
          <p className="text-sm text-muted-foreground">
            {looksLikeHeartlandItemQuery(q)
              ? "Heartland import failed for that Item #. Check the message above or try New Product → Look up grid."
              : "Try different filters, or search a Heartland Item # to import it."}
          </p>
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
                      Item # {itemNumberLabel(product)}
                      {variantCountLabel(product) ? (
                        <span className="ml-1.5 normal-case tracking-normal">
                          · {variantCountLabel(product)}
                        </span>
                      ) : null}
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
                    <TableCell
                      className="text-xs text-muted-foreground font-mono"
                      title={(product.variants ?? [])
                        .map((variant) => variant.heartland_public_id)
                        .join(", ")}
                    >
                      <span>{itemNumberLabel(product)}</span>
                      {variantCountLabel(product) ? (
                        <span className="block text-[10px] uppercase tracking-wider mt-0.5">
                          {variantCountLabel(product)}
                        </span>
                      ) : null}
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
