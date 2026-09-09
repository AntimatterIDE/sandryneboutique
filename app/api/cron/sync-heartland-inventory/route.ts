import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { heartlandRetailConfigured } from "@/lib/heartland-retail";
import { revalidateInventoryPages, syncRetailInventoryToSite } from "@/lib/order-inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Mirrors Heartland Retail qty_available onto the website.
 * Heartland is the source of truth, including manual inventory adjustments.
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

  const { data: unsynced } = await admin
    .from("orders")
    .select("*")
    .eq("heartland_sync_status", "pending")
    .is("refunded_at", null)
    .neq("status", "returned")
    .neq("status", "cancelled");
  if (unsynced?.length) {
    const { syncWebsiteOrderToRetail } = await import("@/lib/retail-order-sync");
    for (const order of unsynced) {
      try {
        await syncWebsiteOrderToRetail(admin, order);
      } catch (err) {
        console.error(`Automatic Retail sync failed for order ${order.id}:`, err);
      }
    }
  }

  try {
    const result = await syncRetailInventoryToSite(admin);
    if (result.updated > 0) revalidateInventoryPages();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Heartland Retail inventory sync failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Retail inventory fetch failed." },
      { status: 502 }
    );
  }
}
