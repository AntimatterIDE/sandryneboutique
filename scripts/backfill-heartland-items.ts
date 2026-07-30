/**
 * Backfills Heartland Retail size/color variants onto imported Shopify products.
 *
 * For each Shopify handle:
 *   1. Collect Variant SKUs + size/color options from the CSV
 *   2. Verify each SKU against Heartland Retail
 *   3. Prefer expanding the Heartland Item Grid when available
 *   4. Upsert one product_variants row per sellable size/color
 *
 * Usage:
 *   npm run backfill:heartland -- [--dry-run] [path/to.csv]
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   HEARTLAND_RETAIL_SUBDOMAIN
 *   HEARTLAND_RETAIL_API_TOKEN
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv();

import {
  extractVariantOptions,
  lookupItemGrid,
  searchItemsByPublicIds,
  type HeartlandGridVariant,
  type HeartlandRetailItem,
} from "../lib/heartland-retail";

const DEFAULT_CSV = resolve(process.cwd(), "data/shopify-products.csv");
const BATCH_SIZE = 50;

interface ShopifyRow {
  Handle?: string;
  "Variant SKU"?: string;
  "Option1 Name"?: string;
  "Option1 Value"?: string;
  "Option2 Name"?: string;
  "Option2 Value"?: string;
  "Option3 Name"?: string;
  "Option3 Value"?: string;
  [key: string]: string | undefined;
}

interface ShopifyVariantRow {
  sku: string;
  size: string | null;
  color: string | null;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  price: number;
}

function slugify(handle: string): string {
  return handle
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function optionBucket(name: string | undefined): "size" | "color" | "other" {
  const n = (name ?? "").trim().toLowerCase();
  if (!n) return "other";
  if (n === "size" || n === "sizes" || n.includes("size")) return "size";
  if (
    n === "color" ||
    n === "colour" ||
    n === "colors" ||
    n === "colours" ||
    n.includes("color")
  ) {
    return "color";
  }
  return "other";
}

function parseArgs(argv: string[]): {
  csvPath: string;
  dryRun: boolean;
  targetSlug: string | null;
} {
  let csvPath = DEFAULT_CSV;
  let dryRun = false;
  let targetSlug: string | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--slug=")) targetSlug = slugify(arg.slice("--slug=".length));
    else if (arg.toLowerCase().endsWith(".csv")) csvPath = resolve(process.cwd(), arg);
    else if (arg.startsWith("-")) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }

  return { csvPath, dryRun, targetSlug };
}

function variantsBySlug(rows: ShopifyRow[]): Map<string, ShopifyVariantRow[]> {
  const bySlug = new Map<string, ShopifyVariantRow[]>();

  for (const row of rows) {
    const handle = (row.Handle ?? "").trim();
    const sku = (row["Variant SKU"] ?? "").trim();
    if (!handle || !sku) continue;

    const slug = slugify(handle);
    if (!slug) continue;

    let size: string | null = null;
    let color: string | null = null;
    const options = [
      { name: row["Option1 Name"], value: row["Option1 Value"] },
      { name: row["Option2 Name"], value: row["Option2 Value"] },
      { name: row["Option3 Name"], value: row["Option3 Value"] },
    ];
    for (const opt of options) {
      const bucket = optionBucket(opt.name);
      const value = opt.value?.trim();
      if (!value || value.toLowerCase() === "default title") continue;
      if (bucket === "size" && !size) size = value;
      if (bucket === "color" && !color) color = value;
    }

    const list = bySlug.get(slug) ?? [];
    if (!list.some((entry) => entry.sku === sku)) {
      list.push({ sku, size, color });
    }
    bySlug.set(slug, list);
  }

  return bySlug;
}

function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local)."
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchProducts(supabase: SupabaseClient): Promise<ProductRow[]> {
  const products: ProductRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("products")
      .select("id, slug, name, price")
      .order("slug")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Product fetch failed: ${error.message}`);

    const rows = (data ?? []) as ProductRow[];
    products.push(...rows);
    if (rows.length < pageSize) break;
  }

  return products;
}

function toVariantPayload(
  productId: string,
  productPrice: number,
  variant: HeartlandGridVariant,
  shopifyHint?: ShopifyVariantRow
) {
  return {
    product_id: productId,
    heartland_item_id: variant.heartland_item_id,
    heartland_public_id: variant.heartland_public_id,
    heartland_grid_id: variant.heartland_grid_id,
    size: variant.size ?? shopifyHint?.size ?? null,
    color: variant.color ?? shopifyHint?.color ?? null,
    price: variant.price || productPrice,
    inventory_count: variant.inventory_count,
    active: variant.active,
    sort_order: variant.sort_order,
    updated_at: new Date().toISOString(),
  };
}

function productAggregate(
  variants: ReturnType<typeof toVariantPayload>[]
) {
  const active = variants.filter((variant) => variant.active);
  const primary = active[0] ?? null;
  return {
    inventory_count: active.reduce(
      (total, variant) => total + variant.inventory_count,
      0
    ),
    sizes: [...new Set(active.map((variant) => variant.size).filter(Boolean))].sort(),
    colors: [...new Set(active.map((variant) => variant.color).filter(Boolean))].sort(),
    heartland_item_id: primary?.heartland_item_id ?? null,
    heartland_public_id: primary?.heartland_public_id ?? null,
  };
}

function itemToGridVariant(
  item: HeartlandRetailItem,
  shopifyHint?: ShopifyVariantRow,
  index = 0
): HeartlandGridVariant {
  const opts = extractVariantOptions(item);
  return {
    heartland_item_id: item.id,
    heartland_public_id: String(item.public_id ?? item.id),
    heartland_grid_id: typeof item.grid_id === "number" ? item.grid_id : null,
    size: opts.size ?? shopifyHint?.size ?? null,
    color: opts.color ?? shopifyHint?.color ?? null,
    price: Number(item.price) || 0,
    inventory_count: 0,
    active: item.active !== false,
    description: (item.description || "").trim(),
    sort_order: index,
  };
}

async function resolveGridVariants(
  shopifyVariants: ShopifyVariantRow[],
  resolvedItems: Map<string, HeartlandRetailItem>
): Promise<HeartlandGridVariant[]> {
  const seedSku = shopifyVariants.find((row) => resolvedItems.has(row.sku))?.sku;
  if (!seedSku) return [];

  try {
    const grid = await lookupItemGrid(seedSku);
    if (grid && grid.variants.length > 0) return grid.variants;
  } catch (err) {
    console.warn(`  ! grid expand failed for ${seedSku}:`, err);
  }

  // Fallback: one variant per verified Shopify SKU (no grid).
  return shopifyVariants
    .map((row, index) => {
      const item = resolvedItems.get(row.sku);
      if (!item) return null;
      return itemToGridVariant(item, row, index);
    })
    .filter((value): value is HeartlandGridVariant => value != null);
}

async function main() {
  const { csvPath, dryRun, targetSlug } = parseArgs(process.argv.slice(2));

  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  if (!process.env.HEARTLAND_RETAIL_SUBDOMAIN || !process.env.HEARTLAND_RETAIL_API_TOKEN) {
    console.error(
      "Missing HEARTLAND_RETAIL_SUBDOMAIN or HEARTLAND_RETAIL_API_TOKEN.\n" +
        "Copy them from Vercel into .env.local, or run: vercel env pull .env.local"
    );
    process.exit(1);
  }

  console.log(`Reading ${csvPath}`);
  const rows = parse(readFileSync(csvPath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as ShopifyRow[];

  const allBySlug = variantsBySlug(rows);
  const bySlug = targetSlug
    ? new Map(
        allBySlug.has(targetSlug)
          ? [[targetSlug, allBySlug.get(targetSlug)!]]
          : []
      )
    : allBySlug;
  if (targetSlug && bySlug.size === 0) {
    throw new Error(`Shopify handle not found in CSV: ${targetSlug}`);
  }
  const allSkus = [...new Set([...bySlug.values()].flatMap((list) => list.map((v) => v.sku)))];
  console.log(`${bySlug.size} Shopify products carry ${allSkus.length} distinct Item #s.`);

  console.log("Verifying Item #s against Heartland Retail…");
  const resolvedItems = new Map<string, HeartlandRetailItem>();
  for (let i = 0; i < allSkus.length; i += BATCH_SIZE) {
    const batch = allSkus.slice(i, i + BATCH_SIZE);
    const found = await searchItemsByPublicIds(batch);
    for (const [publicId, item] of found) resolvedItems.set(publicId, item);
    process.stdout.write(
      `\r  verified ${Math.min(i + BATCH_SIZE, allSkus.length)}/${allSkus.length} Item #s — ${resolvedItems.size} found`
    );
  }
  process.stdout.write("\n");

  const supabase = createServiceClient();
  const catalogProducts = await fetchProducts(supabase);
  const products = targetSlug
    ? catalogProducts.filter((product) => product.slug === targetSlug)
    : catalogProducts;
  console.log(`Loaded ${products.length} products from Supabase.`);

  let linkedProducts = 0;
  let linkedVariants = 0;
  let skippedNoSkus = 0;
  let skippedUnverified = 0;
  const errors: string[] = [];

  for (const [index, product] of products.entries()) {
    const shopifyVariants = bySlug.get(product.slug);
    if (!shopifyVariants?.length) {
      skippedNoSkus += 1;
      continue;
    }

    process.stdout.write(
      `\r→ ${index + 1}/${products.length} ${product.slug}…`.padEnd(80)
    );

    let gridVariants: HeartlandGridVariant[];
    try {
      gridVariants = await resolveGridVariants(shopifyVariants, resolvedItems);
    } catch (err) {
      errors.push(
        `${product.slug}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    if (gridVariants.length === 0) {
      skippedUnverified += 1;
      continue;
    }

    const shopifyBySku = new Map(shopifyVariants.map((row) => [row.sku, row]));
    const payloads = gridVariants.map((variant) =>
      toVariantPayload(
        product.id,
        product.price,
        variant,
        shopifyBySku.get(variant.heartland_public_id)
      )
    );

    if (dryRun) {
      linkedProducts += 1;
      linkedVariants += payloads.length;
      continue;
    }

    const { error: clearError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", product.id);
    if (clearError) {
      errors.push(`${product.slug}: clear failed — ${clearError.message}`);
      continue;
    }

    const { error: insertError } = await supabase.from("product_variants").insert(payloads);
    if (insertError) {
      errors.push(`${product.slug}: insert failed — ${insertError.message}`);
      continue;
    }

    // Multi-row inserts can leave a row-level aggregation trigger observing
    // only part of the statement. Persist the verified final aggregate once.
    const { error: aggregateError } = await supabase
      .from("products")
      .update(productAggregate(payloads))
      .eq("id", product.id);
    if (aggregateError) {
      errors.push(`${product.slug}: aggregate failed — ${aggregateError.message}`);
      continue;
    }

    linkedProducts += 1;
    linkedVariants += payloads.length;
  }

  process.stdout.write("\n");
  console.log("\n========== Backfill report ==========");
  console.log(
    `${dryRun ? "Would link" : "Linked"}: ${linkedProducts} products / ${linkedVariants} variants`
  );
  console.log(`No Shopify SKU in CSV: ${skippedNoSkus}`);
  console.log(`SKUs absent from Retail: ${skippedUnverified}`);
  console.log(`Item #s not found in Retail: ${allSkus.length - resolvedItems.size}`);
  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors.slice(0, 25)) console.log(`  - ${e}`);
    if (errors.length > 25) console.log(`  … ${errors.length - 25} more`);
    process.exitCode = 1;
  }
  console.log("=====================================\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
