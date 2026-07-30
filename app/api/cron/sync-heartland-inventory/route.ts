import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getInventoryByItemIds,
  heartlandRetailConfigured,
} from "@/lib/heartland-retail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Mirrors Heartland Retail qty_available into product_variants.inventory_count.
 * The product_variants trigger refreshes parent products.inventory_count /
 * sizes / colors.
 *
 * Schedule via vercel.json (every 5 minutes) or call manually:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://yoursite.com/api/cron/sync-heartland-inventory
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!heartlandRetailConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Heartland Retail is not configured." },
      { status: 503 }
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const { data: variants, error } = await admin
    .from("product_variants")
    .select("id, heartland_item_id, inventory_count")
    .eq("active", true);

  if (error) {
    console.error("Inventory sync variant query failed:", error);
    return NextResponse.json({ ok: false, error: "Variant query failed." }, { status: 500 });
  }

  const rows = variants ?? [];
  const itemIds = [
    ...new Set(
      rows
        .map((v) => v.heartland_item_id as number)
        .filter((id): id is number => typeof id === "number" && id > 0)
    ),
  ];

  if (itemIds.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, checked: 0 });
  }

  let qtyByItem: Map<number, number>;
  try {
    qtyByItem = await getInventoryByItemIds(itemIds);
  } catch (err) {
    console.error("Heartland Retail inventory fetch failed:", err);
    return NextResponse.json(
      { ok: false, error: "Retail inventory fetch failed." },
      { status: 502 }
    );
  }

  let updated = 0;
  const failures: string[] = [];

  for (const variant of rows) {
    const itemId = variant.heartland_item_id as number;
    const qty = qtyByItem.get(itemId);
    if (qty == null) continue;
    if (qty === variant.inventory_count) continue;

    const { error: updateError } = await admin
      .from("product_variants")
      .update({
        inventory_count: qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", variant.id);

    if (updateError) {
      failures.push(variant.id);
      console.error(`Inventory sync update failed for variant ${variant.id}:`, updateError);
    } else {
      updated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: rows.length,
    updated,
    failures: failures.length,
  });
}
