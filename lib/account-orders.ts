import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function linkOrdersToCustomer(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!userId || !normalized) return;
  await admin
    .from("orders")
    .update({ user_id: userId })
    .is("user_id", null)
    .ilike("email", normalized);
}
