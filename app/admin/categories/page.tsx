import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { getCategoryTree } from "@/lib/data/categories";

export const metadata: Metadata = {
  title: "Categories",
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const tree = await getCategoryTree();
  const usingFallback = tree.some((node) => node.id.startsWith("fallback-"));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Create and edit shop categories and subcategories here. You can also add them from a
          product&apos;s Category / Subcategory dropdowns while editing.
        </p>
        {usingFallback ? (
          <p className="mt-3 text-sm text-destructive max-w-2xl">
            Database migration not applied yet — run{" "}
            <code className="font-mono text-xs">supabase/migrations/008_categories.sql</code> in
            the Supabase SQL editor so creates and edits persist.
          </p>
        ) : null}
      </header>
      <CategoryManager tree={tree} />
    </div>
  );
}
