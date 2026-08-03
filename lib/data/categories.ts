import "server-only";

import { createClient, createPrivilegedClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/constants";
import type { Category, CategoryNode } from "@/lib/types";

export type { CategoryNode };

const FALLBACK_TOP_LEVEL: CategoryNode[] = CATEGORIES.filter((c) => c.dbCategory).map(
  (c, index) => ({
    id: `fallback-${c.dbCategory}`,
    slug: c.dbCategory!,
    name: c.label,
    description: c.description,
    parent_id: null,
    sort_order: (index + 1) * 10,
    created_at: new Date(0).toISOString(),
    children: [],
  })
);

function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function nestCategories(rows: Category[]): CategoryNode[] {
  const childrenByParent = new Map<string, Category[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = childrenByParent.get(row.parent_id) ?? [];
    list.push(row);
    childrenByParent.set(row.parent_id, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  return rows
    .filter((row) => !row.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((row) => ({
      ...row,
      children: childrenByParent.get(row.id) ?? [],
    }));
}

/** Top-level categories with nested subcategories. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  if (!supabaseConfigured()) return FALLBACK_TOP_LEVEL;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error || !data) {
      // Table may not exist until migration 008 is applied.
      console.error("Category load failed:", error);
      return FALLBACK_TOP_LEVEL;
    }

    const rows = data as Category[];
    if (rows.length === 0) return FALLBACK_TOP_LEVEL;
    return nestCategories(rows);
  } catch (err) {
    console.error("Category load failed:", err);
    return FALLBACK_TOP_LEVEL;
  }
}

/** Flat list of every category + subcategory row. */
export async function getAllCategories(): Promise<Category[]> {
  const tree = await getCategoryTree();
  return tree.flatMap((parent) => [parent, ...parent.children]);
}

/** Resolve a slug to a category/subcategory node (searches tree). */
export async function findCategoryBySlug(
  slug: string
): Promise<{ category: Category; parent: Category | null } | null> {
  const tree = await getCategoryTree();
  for (const parent of tree) {
    if (parent.slug === slug) return { category: parent, parent: null };
    const child = parent.children.find((c) => c.slug === slug);
    if (child) return { category: child, parent };
  }
  return null;
}

/** Privileged read for admin mutations after auth checks. */
export async function getCategoryTreePrivileged(): Promise<CategoryNode[]> {
  if (!supabaseConfigured()) return FALLBACK_TOP_LEVEL;
  try {
    const supabase = await createPrivilegedClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error || !data?.length) return FALLBACK_TOP_LEVEL;
    return nestCategories(data as Category[]);
  } catch {
    return FALLBACK_TOP_LEVEL;
  }
}
