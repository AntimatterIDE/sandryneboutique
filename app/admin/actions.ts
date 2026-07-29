"use server";

import { revalidatePath } from "next/cache";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { getSessionInfo } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

const PRODUCT_CATEGORIES = [
  "bottoms",
  "dresses",
  "accessories-jewelry",
  "tops",
  "active-wear",
] as const;

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  images: string[];
  inventory_count: number;
  category: string;
  slug: string;
  sizes: string[];
  colors: string[];
  is_new: boolean;
  on_sale: boolean;
  sale_price: number | null;
  heartland_item_id: number | null;
  heartland_public_id: string | null;
}

async function requireAdmin(): Promise<ActionResult | null> {
  const { profile } = await getSessionInfo();
  if (profile?.role !== "admin") {
    return { ok: false, message: "You are not authorized to perform this action." };
  }
  return null;
}

function validateProduct(input: ProductInput): string | null {
  if (!input.name?.trim()) return "Product name is required.";
  if (!input.slug?.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
    return "Slug must be lowercase letters, numbers, and hyphens (e.g. silk-slip-dress).";
  }
  if (!Number.isFinite(input.price) || input.price < 0) return "Price must be a positive number.";
  if (!Number.isInteger(input.inventory_count) || input.inventory_count < 0) {
    return "Inventory must be a non-negative whole number.";
  }
  if (!PRODUCT_CATEGORIES.includes(input.category as (typeof PRODUCT_CATEGORIES)[number])) {
    return "Please choose a valid category.";
  }
  if (input.on_sale && (input.sale_price == null || input.sale_price <= 0)) {
    return "Sale price is required when the product is on sale.";
  }
  if (input.images.length === 0) return "Add at least one product image.";
  if (
    input.heartland_item_id != null &&
    (!Number.isInteger(input.heartland_item_id) || input.heartland_item_id <= 0)
  ) {
    return "Heartland item ID must be a positive whole number.";
  }
  return null;
}

function revalidateStore() {
  revalidatePath("/", "layout");
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const invalid = validateProduct(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...input, sale_price: input.on_sale ? input.sale_price : null })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message?.includes("heartland_item_id")) {
        return { ok: false, message: "That Heartland item ID is already linked to another product." };
      }
      return { ok: false, message: "That slug is already in use." };
    }
    console.error("Product create failed:", error);
    return { ok: false, message: "Failed to create product. Please try again." };
  }

  revalidateStore();
  return { ok: true, message: "Product created.", id: data.id };
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const invalid = validateProduct(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();
  const { error } = await supabase
    .from("products")
    .update({ ...input, sale_price: input.on_sale ? input.sale_price : null })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      if (error.message?.includes("heartland_item_id")) {
        return { ok: false, message: "That Heartland item ID is already linked to another product." };
      }
      return { ok: false, message: "That slug is already in use." };
    }
    console.error("Product update failed:", error);
    return { ok: false, message: "Failed to update product. Please try again." };
  }

  revalidateStore();
  return { ok: true, message: "Product updated.", id };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createPrivilegedClient();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    console.error("Product delete failed:", error);
    return { ok: false, message: "Failed to delete product. Please try again." };
  }

  revalidateStore();
  return { ok: true, message: "Product deleted." };
}

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image: string | null;
  published: boolean;
  /** Tagged product ids in "Shop the Look" display order. */
  product_ids: string[];
}

function validatePost(input: PostInput): string | null {
  if (!input.title?.trim()) return "Post title is required.";
  if (!input.slug?.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) {
    return "Slug must be lowercase letters, numbers, and hyphens (e.g. how-to-style-silk).";
  }
  if (!input.excerpt?.trim()) return "An excerpt is required — it doubles as the SEO description.";
  if (!input.content?.trim()) return "Post content is required.";
  return null;
}

async function syncPostProducts(
  supabase: Awaited<ReturnType<typeof createPrivilegedClient>>,
  postId: string,
  productIds: string[]
): Promise<string | null> {
  const { error: deleteError } = await supabase
    .from("post_products")
    .delete()
    .eq("post_id", postId);
  if (deleteError) {
    console.error("Post products clear failed:", deleteError);
    return "Failed to update tagged products.";
  }

  if (productIds.length === 0) return null;

  const rows = productIds.map((productId, i) => ({
    post_id: postId,
    product_id: productId,
    position: i,
  }));
  const { error: insertError } = await supabase.from("post_products").insert(rows);
  if (insertError) {
    console.error("Post products insert failed:", insertError);
    return "Failed to update tagged products.";
  }
  return null;
}

export async function createPost(input: PostInput): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const invalid = validatePost(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();
  const { product_ids, ...post } = input;
  const { data, error } = await supabase
    .from("posts")
    .insert({
      ...post,
      published_at: input.published ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, message: "That slug is already in use." };
    console.error("Post create failed:", error);
    return { ok: false, message: "Failed to create post. Please try again." };
  }

  const tagError = await syncPostProducts(supabase, data.id, product_ids);
  if (tagError) return { ok: false, message: tagError };

  revalidateStore();
  return { ok: true, message: "Post created.", id: data.id };
}

export async function updatePost(id: string, input: PostInput): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const invalid = validatePost(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();

  const { data: existing, error: fetchError } = await supabase
    .from("posts")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !existing) {
    console.error("Post fetch failed:", fetchError);
    return { ok: false, message: "Post not found." };
  }

  const { product_ids, ...post } = input;
  const { error } = await supabase
    .from("posts")
    .update({
      ...post,
      // Stamp published_at the first time a post goes live; keep it stable after.
      published_at:
        input.published && !existing.published_at
          ? new Date().toISOString()
          : existing.published_at,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { ok: false, message: "That slug is already in use." };
    console.error("Post update failed:", error);
    return { ok: false, message: "Failed to update post. Please try again." };
  }

  const tagError = await syncPostProducts(supabase, id, product_ids);
  if (tagError) return { ok: false, message: tagError };

  revalidateStore();
  return { ok: true, message: "Post updated.", id };
}

export async function deletePost(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createPrivilegedClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);

  if (error) {
    console.error("Post delete failed:", error);
    return { ok: false, message: "Failed to delete post. Please try again." };
  }

  revalidateStore();
  return { ok: true, message: "Post deleted." };
}

export interface HomepageSectionInput {
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  product_ids: string[];
  max_items: number;
  enabled: boolean;
}

function validateHomepageSection(input: HomepageSectionInput): string | null {
  if (!input.title?.trim()) return "Section title is required.";
  if (!input.cta_label?.trim()) return "CTA label is required.";
  if (!input.cta_href?.trim() || !input.cta_href.startsWith("/")) {
    return "CTA link must be a site path starting with / (e.g. /shop?category=tops).";
  }
  if (!Number.isInteger(input.max_items) || input.max_items < 1 || input.max_items > 24) {
    return "Max products must be between 1 and 24.";
  }
  if (input.product_ids.length > input.max_items) {
    return `Select at most ${input.max_items} products for this section.`;
  }
  return null;
}

export async function updateHomepageSection(
  id: string,
  input: HomepageSectionInput
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const invalid = validateHomepageSection(input);
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();
  const { error } = await supabase
    .from("homepage_sections")
    .update({
      title: input.title.trim(),
      subtitle: input.subtitle.trim(),
      cta_label: input.cta_label.trim(),
      cta_href: input.cta_href.trim(),
      product_ids: input.product_ids,
      max_items: input.max_items,
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Homepage section update failed:", error);
    return {
      ok: false,
      message:
        "Failed to save section. Confirm migration 005_homepage_sections.sql was run in Supabase.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  return { ok: true, message: "Homepage section saved." };
}

export async function deleteNewsletterSubscriber(id: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createPrivilegedClient();
  const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);

  if (error) {
    console.error("Newsletter delete failed:", error);
    return {
      ok: false,
      message:
        "Failed to remove subscriber. Confirm migration 006_newsletter_admin.sql was run in Supabase.",
    };
  }

  revalidatePath("/admin/newsletter");
  return { ok: true, message: "Subscriber removed." };
}

const ORDER_STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "cancelled"];

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false, message: "Invalid order status." };
  }

  const supabase = await createPrivilegedClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);

  if (error) {
    console.error("Order status update failed:", error);
    return { ok: false, message: "Failed to update order status." };
  }

  revalidatePath("/admin/orders");
  return { ok: true, message: "Order updated." };
}

export interface HeartlandItemLookup {
  heartland_item_id: number;
  heartland_public_id: string | null;
  name: string;
  description: string;
  price: number;
  inventory_count: number;
  active: boolean;
}

export type HeartlandLookupResult =
  | { ok: true; item: HeartlandItemLookup }
  | { ok: false; message: string };

/**
 * Look up a Heartland Retail item by Item # / public_id first, then by
 * internal id when the value is numeric. Heartland Item # values are often
 * numeric strings, so treating every number as an internal id causes false
 * 404s (for example, Item # 11907 is not necessarily GET /items/11907).
 */
export async function lookupHeartlandItem(rawId: string): Promise<HeartlandLookupResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, message: denied.message };

  const { getItem, getItemQtyAvailable, searchItemsByPublicId } = await import(
    "@/lib/heartland-retail"
  );

  const trimmed = rawId.trim();
  if (!trimmed) return { ok: false, message: "Enter a Heartland item ID or Item #." };

  try {
    const matches = await searchItemsByPublicId(trimmed);
    let item =
      matches.find((match) => String(match.public_id ?? "") === trimmed) ??
      matches[0];

    if (!item && /^\d+$/.test(trimmed)) {
      try {
        item = await getItem(Number(trimmed));
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes("→ 404:")) throw err;
      }
    }

    if (!item) {
      return { ok: false, message: `No Heartland item found for “${trimmed}”.` };
    }

    let inventory_count = 0;
    try {
      inventory_count = await getItemQtyAvailable(item.id);
    } catch (err) {
      console.warn("Retail inventory lookup during item fetch:", err);
    }

    const name = (item.description || "").trim() || `Item ${item.id}`;
    const description = (item.long_description || item.description || "").trim();

    return {
      ok: true,
      item: {
        heartland_item_id: item.id,
        heartland_public_id: item.public_id ?? null,
        name,
        description,
        price: Number(item.price) || 0,
        inventory_count,
        active: item.active !== false,
      },
    };
  } catch (err) {
    console.error("Heartland item lookup failed:", err);
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not look up that Heartland item. Check your Retail credentials.",
    };
  }
}
