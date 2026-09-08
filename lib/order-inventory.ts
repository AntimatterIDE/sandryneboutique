import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderItem } from "@/lib/types";

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
