import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/lib/types";
import { getInventoryByItemIds } from "@/lib/heartland-retail";

export async function restoreSiteInventory(
  admin: SupabaseClient,
  items: OrderItem[]
): Promise<void> {
  for (const item of items) {
    if (item.variant_id) {
      const { error } = await admin.rpc("increment_variant_inventory", {
        p_variant_id: item.variant_id,
        p_quantity: item.quantity,
      });
      if (!error) continue;

      const { data } = await admin
        .from("product_variants")
        .select("inventory_count")
        .eq("id", item.variant_id)
        .single();
      if (data) {
        await admin
          .from("product_variants")
          .update({
            inventory_count: Number(data.inventory_count) + item.quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.variant_id);
      }
      continue;
    }

    const { error } = await admin.rpc("increment_inventory", {
      p_product_id: item.product_id,
      p_quantity: item.quantity,
    });
    if (!error) continue;

    const { data } = await admin
      .from("products")
      .select("inventory_count")
      .eq("id", item.product_id)
      .single();
    if (data) {
      await admin
        .from("products")
        .update({
          inventory_count: Number(data.inventory_count) + item.quantity,
        })
        .eq("id", item.product_id);
    }
  }
}

export interface RetailInventorySyncResult {
  checked: number;
  updated: number;
  skipped: number;
  failures: string[];
}

function pendingItemIds(orders: { items?: unknown }[] | null): Set<number> {
  const ids = new Set<number>();
  for (const order of orders ?? []) {
    const items = (order.items ?? []) as { heartland_item_id?: number | null }[];
    for (const item of items) {
      if (typeof item.heartland_item_id === "number" && item.heartland_item_id > 0) {
        ids.add(item.heartland_item_id);
      }
    }
  }
  return ids;
}

/**
 * Heartland Retail is the source of truth. Copy qty_available onto variants
 * (and parent products via trigger) plus any product-level Heartland items.
 *
 * Items on still-pending website→Retail sales are skipped so a just-placed
 * order is not restocked before Heartland receives it. Failed leftover test
 * orders are not skipped.
 */
export async function syncRetailInventoryToSite(
  admin: SupabaseClient,
  options?: { skipPendingOrderItems?: boolean }
): Promise<RetailInventorySyncResult> {
  const skipItemIds = new Set<number>();
  if (options?.skipPendingOrderItems !== false) {
    const { data: pending } = await admin
      .from("orders")
      .select("items")
      .eq("heartland_sync_status", "pending")
      .is("refunded_at", null)
      .neq("status", "returned")
      .neq("status", "cancelled");
    for (const id of pendingItemIds(pending)) skipItemIds.add(id);
  }

  const { data: variants, error: variantError } = await admin
    .from("product_variants")
    .select("id, product_id, heartland_item_id, inventory_count")
    .eq("active", true);
  if (variantError) {
    throw new Error(variantError.message || "Variant query failed.");
  }

  const { data: products } = await admin
    .from("products")
    .select("id, heartland_item_id, inventory_count")
    .not("heartland_item_id", "is", null);

  const productsWithVariants = new Set((variants ?? []).map((row) => row.product_id as string));
  const productOnly = (products ?? []).filter(
    (row) =>
      !productsWithVariants.has(row.id as string) &&
      typeof row.heartland_item_id === "number" &&
      row.heartland_item_id > 0
  );

  const itemIds = [
    ...new Set(
      [
        ...(variants ?? []).map((row) => row.heartland_item_id as number),
        ...productOnly.map((row) => row.heartland_item_id as number),
      ].filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];

  const result: RetailInventorySyncResult = {
    checked: (variants ?? []).length + productOnly.length,
    updated: 0,
    skipped: 0,
    failures: [],
  };

  if (itemIds.length === 0) return result;

  const qtyByItem = await getInventoryByItemIds(itemIds);
  const now = new Date().toISOString();

  for (const variant of variants ?? []) {
    const itemId = variant.heartland_item_id as number;
    if (skipItemIds.has(itemId)) {
      result.skipped += 1;
      continue;
    }
    const qty = qtyByItem.get(itemId);
    if (qty == null || qty === variant.inventory_count) continue;

    const { error } = await admin
      .from("product_variants")
      .update({ inventory_count: qty, updated_at: now })
      .eq("id", variant.id);
    if (error) {
      result.failures.push(String(variant.id));
      console.error(`Inventory sync update failed for variant ${variant.id}:`, error);
    } else {
      result.updated += 1;
    }
  }

  for (const product of productOnly) {
    const itemId = product.heartland_item_id as number;
    if (skipItemIds.has(itemId)) {
      result.skipped += 1;
      continue;
    }
    const qty = qtyByItem.get(itemId);
    if (qty == null || qty === product.inventory_count) continue;

    const { error } = await admin
      .from("products")
      .update({ inventory_count: qty })
      .eq("id", product.id);
    if (error) {
      result.failures.push(String(product.id));
      console.error(`Inventory sync update failed for product ${product.id}:`, error);
    } else {
      result.updated += 1;
    }
  }

  return result;
}

export function revalidateInventoryPages(): void {
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/admin/products");
}

/** After a Heartland return/void, copy live Retail qty onto the website. */
export async function mirrorRetailQtyToSite(
  admin: SupabaseClient,
  items: OrderItem[]
): Promise<void> {
  const itemIds = [
    ...new Set(
      items
        .map((item) => item.heartland_item_id)
        .filter((id): id is number => typeof id === "number" && id > 0)
    ),
  ];
  if (itemIds.length === 0) {
    await restoreSiteInventory(admin, items);
    return;
  }

  const qtyByItem = await getInventoryByItemIds(itemIds);
  for (const item of items) {
    if (item.heartland_item_id == null) continue;
    const qty = qtyByItem.get(item.heartland_item_id);
    if (qty == null) continue;

    if (item.variant_id) {
      await admin
        .from("product_variants")
        .update({
          inventory_count: qty,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.variant_id);
    } else {
      await admin.from("products").update({ inventory_count: qty }).eq("id", item.product_id);
    }
  }
}
