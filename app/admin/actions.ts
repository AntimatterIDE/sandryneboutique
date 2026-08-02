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

export type ProductImageUploadResult =
  | {
      ok: true;
      path: string;
      token: string;
      publicUrl: string;
    }
  | {
      ok: false;
      message: string;
    };

const PRODUCT_CATEGORIES = [
  "bottoms",
  "dresses",
  "accessories-jewelry",
  "tops",
  "active-wear",
] as const;

export interface VariantInput {
  id?: string;
  heartland_item_id: number;
  heartland_public_id: string;
  heartland_grid_id: number | null;
  size: string | null;
  color: string | null;
  price: number;
  inventory_count: number;
  active: boolean;
  sort_order: number;
}

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
  variants: VariantInput[];
}

async function requireAdmin(): Promise<ActionResult | null> {
  const { profile } = await getSessionInfo();
  if (profile?.role !== "admin") {
    return { ok: false, message: "You are not authorized to perform this action." };
  }
  return null;
}

const PRODUCT_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PRODUCT_IMAGE_NAME_EXTENSIONS: Record<string, string> = {
  avif: "avif",
  gif: "gif",
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  webp: "webp",
};

function extensionForImageUpload(contentType: string, fileName?: string): string | null {
  const normalizedType = contentType.trim().toLowerCase();
  if (normalizedType === "image/heic" || normalizedType === "image/heif") {
    return null;
  }
  if (PRODUCT_IMAGE_EXTENSIONS[normalizedType]) {
    return PRODUCT_IMAGE_EXTENSIONS[normalizedType];
  }
  const match = fileName?.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match && PRODUCT_IMAGE_NAME_EXTENSIONS[match[1]]) {
    return PRODUCT_IMAGE_NAME_EXTENSIONS[match[1]];
  }
  return null;
}

/**
 * Authorize a direct browser → Supabase Storage upload.
 * Keeps large photos off the Vercel request body while still using the
 * privileged server client so AUTH_BYPASS / RLS cannot block admins.
 */
export async function createProductImageUpload(
  contentType: string,
  size: number,
  fileName?: string
): Promise<ProductImageUploadResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, message: denied.message };

  const normalizedType = contentType.trim().toLowerCase();
  if (normalizedType === "image/heic" || normalizedType === "image/heif") {
    return {
      ok: false,
      message: "iPhone HEIC photos aren’t supported — export as JPG or PNG first.",
    };
  }

  const extension = extensionForImageUpload(contentType, fileName);
  if (!extension) {
    return { ok: false, message: "Choose a JPG, PNG, WebP, AVIF, or GIF image." };
  }
  if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024) {
    return { ok: false, message: "Images must be smaller than 10MB." };
  }

  const path = `${crypto.randomUUID()}.${extension}`;
  const supabase = await createPrivilegedClient();
  const { data, error } = await supabase.storage
    .from("product-images")
    .createSignedUploadUrl(path);

  if (error || !data?.token) {
    console.error("Product image upload authorization failed:", error);
    return {
      ok: false,
      message: error?.message || "Could not authorize the image upload. Please try again.",
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);

  return { ok: true, path, token: data.token, publicUrl };
}

function validateProduct(
  input: ProductInput,
  options: { requireVariants: boolean }
): string | null {
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

  if (options.requireVariants && input.variants.length === 0) {
    return "Look up a Heartland Item # first so this product has size/color variants.";
  }

  const seenPublic = new Set<string>();
  const seenItem = new Set<number>();
  for (const variant of input.variants) {
    if (!Number.isInteger(variant.heartland_item_id) || variant.heartland_item_id <= 0) {
      return "Each variant needs a valid Heartland internal item ID.";
    }
    if (!variant.heartland_public_id?.trim()) {
      return "Each variant needs a Heartland Item #.";
    }
    if (!Number.isFinite(variant.price) || variant.price < 0) {
      return "Each variant needs a valid price.";
    }
    if (!Number.isInteger(variant.inventory_count) || variant.inventory_count < 0) {
      return "Each variant needs a valid inventory count.";
    }
    const publicId = variant.heartland_public_id.trim();
    if (seenPublic.has(publicId)) return `Duplicate Item # ${publicId}.`;
    if (seenItem.has(variant.heartland_item_id)) {
      return `Duplicate Heartland item ID ${variant.heartland_item_id}.`;
    }
    seenPublic.add(publicId);
    seenItem.add(variant.heartland_item_id);
  }

  return null;
}

function revalidateStore() {
  revalidatePath("/", "layout");
}

function productRowFromInput(input: ProductInput) {
  const sizes = [
    ...new Set(
      input.variants
        .map((v) => v.size?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const colors = [
    ...new Set(
      input.variants
        .map((v) => v.color?.trim())
        .filter((value): value is string => Boolean(value))
    ),
  ];
  const variantInventory = input.variants
    .filter((v) => v.active)
    .reduce((sum, v) => sum + v.inventory_count, 0);
  const primary = input.variants[0];

  return {
    name: input.name,
    description: input.description,
    price: input.price,
    images: input.images,
    // Legacy products may have no variants yet — keep the form's inventory mirror.
    inventory_count: input.variants.length > 0 ? variantInventory : input.inventory_count,
    category: input.category,
    slug: input.slug,
    sizes: sizes.length > 0 ? sizes : input.sizes,
    colors: colors.length > 0 ? colors : input.colors,
    is_new: input.is_new,
    on_sale: input.on_sale,
    sale_price: input.on_sale ? input.sale_price : null,
    heartland_item_id: primary?.heartland_item_id ?? input.heartland_item_id,
    heartland_public_id: primary?.heartland_public_id ?? input.heartland_public_id,
  };
}

async function syncProductVariants(
  supabase: Awaited<ReturnType<typeof createPrivilegedClient>>,
  productId: string,
  variants: VariantInput[]
): Promise<string | null> {
  const { data: existing, error: existingError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);

  if (existingError) {
    console.error("Variant load failed:", existingError);
    return "Failed to load existing variants.";
  }

  const keepIds = new Set(variants.map((v) => v.id).filter(Boolean));
  const toDelete = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase.from("product_variants").delete().in("id", toDelete);
    if (error) {
      console.error("Variant delete failed:", error);
      return "Failed to remove outdated variants.";
    }
  }

  for (const [index, variant] of variants.entries()) {
    const payload = {
      product_id: productId,
      heartland_item_id: variant.heartland_item_id,
      heartland_public_id: variant.heartland_public_id.trim(),
      heartland_grid_id: variant.heartland_grid_id,
      size: variant.size?.trim() || null,
      color: variant.color?.trim() || null,
      price: variant.price,
      inventory_count: variant.inventory_count,
      active: variant.active,
      sort_order: variant.sort_order ?? index,
      updated_at: new Date().toISOString(),
    };

    if (variant.id) {
      const { error } = await supabase
        .from("product_variants")
        .update(payload)
        .eq("id", variant.id)
        .eq("product_id", productId);
      if (error) {
        console.error("Variant update failed:", error);
        if (error.code === "23505") {
          return "A Heartland Item # or item ID is already linked to another product.";
        }
        return "Failed to update variants.";
      }
    } else {
      const { error } = await supabase.from("product_variants").insert(payload);
      if (error) {
        console.error("Variant insert failed:", error);
        if (error.code === "23505") {
          return "A Heartland Item # or item ID is already linked to another product.";
        }
        return "Failed to save variants.";
      }
    }
  }

  return null;
}

export async function createProduct(input: ProductInput): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const invalid = validateProduct(input, { requireVariants: true });
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();
  const { data, error } = await supabase
    .from("products")
    .insert(productRowFromInput(input))
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message?.includes("heartland_item_id")) {
        return {
          ok: false,
          message:
            "That Heartland item ID is already linked to another product. Open the existing product or use a different Item #.",
        };
      }
      return { ok: false, message: "That slug is already in use." };
    }
    console.error("Product create failed:", error);
    return { ok: false, message: error.message || "Failed to create product. Please try again." };
  }

  const variantError = await syncProductVariants(supabase, data.id, input.variants);
  if (variantError) {
    await supabase.from("products").delete().eq("id", data.id);
    return { ok: false, message: variantError };
  }

  revalidateStore();
  return { ok: true, message: "Product created.", id: data.id };
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Legacy Shopify imports often have no Heartland variants yet — still allow
  // photo/name/price edits. Creating a product still requires a Heartland grid.
  const invalid = validateProduct(input, { requireVariants: false });
  if (invalid) return { ok: false, message: invalid };

  const supabase = await createPrivilegedClient();
  const row = productRowFromInput(input);
  // Don't wipe Heartland ids when saving a legacy product with an empty variant list.
  const {
    heartland_item_id: _heartlandItemId,
    heartland_public_id: _heartlandPublicId,
    ...rowWithoutHeartland
  } = row;
  const updatePayload = input.variants.length > 0 ? row : rowWithoutHeartland;

  const { error } = await supabase.from("products").update(updatePayload).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      if (error.message?.includes("heartland_item_id")) {
        return {
          ok: false,
          message:
            "That Heartland item ID is already linked to another product. Open the existing product or use a different Item #.",
        };
      }
      return { ok: false, message: "That slug is already in use." };
    }
    console.error("Product update failed:", error);
    return { ok: false, message: error.message || "Failed to update product. Please try again." };
  }

  if (input.variants.length > 0) {
    const variantError = await syncProductVariants(supabase, id, input.variants);
    if (variantError) return { ok: false, message: variantError };
  }

  revalidateStore();
  return { ok: true, message: "Product updated.", id };
}

/** Persist product photos without requiring a full Heartland variant save. */
export async function updateProductImages(
  id: string,
  images: string[]
): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!Array.isArray(images) || images.some((url) => typeof url !== "string" || !url.trim())) {
    return { ok: false, message: "Image list is invalid." };
  }

  const supabase = await createPrivilegedClient();
  const { error } = await supabase
    .from("products")
    .update({ images: images.map((url) => url.trim()) })
    .eq("id", id);

  if (error) {
    console.error("Product image save failed:", error);
    return { ok: false, message: error.message || "Failed to save product images." };
  }

  revalidateStore();
  return { ok: true, message: "Images saved.", id };
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

export interface HeartlandVariantLookup {
  heartland_item_id: number;
  heartland_public_id: string;
  heartland_grid_id: number | null;
  size: string | null;
  color: string | null;
  price: number;
  inventory_count: number;
  active: boolean;
  sort_order: number;
}

export interface HeartlandItemLookup {
  heartland_item_id: number;
  heartland_public_id: string | null;
  heartland_grid_id: number | null;
  name: string;
  description: string;
  price: number;
  inventory_count: number;
  category: string | null;
  vendor: string | null;
  style: string | null;
  sizes: string[];
  colors: string[];
  variants: HeartlandVariantLookup[];
  active: boolean;
}

export type HeartlandLookupResult =
  | { ok: true; item: HeartlandItemLookup }
  | { ok: false; message: string };

/**
 * Look up a Heartland Retail Item # / internal id and expand its Item Grid
 * into every size/color variant with live inventory.
 */
export async function lookupHeartlandItem(rawId: string): Promise<HeartlandLookupResult> {
  const denied = await requireAdmin();
  if (denied) return { ok: false, message: denied.message };

  const { lookupItemGrid } = await import("@/lib/heartland-retail");

  const trimmed = rawId.trim();
  if (!trimmed) return { ok: false, message: "Enter a Heartland item ID or Item #." };

  try {
    const grid = await lookupItemGrid(trimmed);
    if (!grid || grid.variants.length === 0) {
      return { ok: false, message: `No Heartland item found for “${trimmed}”.` };
    }

    const primary =
      grid.variants.find((v) => String(v.heartland_public_id) === trimmed) ??
      grid.variants.find((v) => String(v.heartland_item_id) === trimmed) ??
      grid.variants[0];

    return {
      ok: true,
      item: {
        heartland_item_id: primary.heartland_item_id,
        heartland_public_id: primary.heartland_public_id,
        heartland_grid_id: grid.heartland_grid_id,
        name: grid.name,
        description: grid.description,
        price: grid.price,
        inventory_count: grid.inventory_count,
        category: grid.category,
        vendor: grid.vendor,
        style: grid.style,
        sizes: grid.sizes,
        colors: grid.colors,
        variants: grid.variants.map((variant) => ({
          heartland_item_id: variant.heartland_item_id,
          heartland_public_id: variant.heartland_public_id,
          heartland_grid_id: variant.heartland_grid_id,
          size: variant.size,
          color: variant.color,
          price: variant.price,
          inventory_count: variant.inventory_count,
          active: variant.active,
          sort_order: variant.sort_order,
        })),
        active: primary.active,
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
