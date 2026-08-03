import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { getCategoryTree } from "@/lib/data/categories";

export const metadata: Metadata = {
  title: "Categories",
};

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const tree = await getCategoryTree();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Manage shop categories and subcategories (for example Tops → Tees, Tanks, Rompers).
          Run migration <code className="font-mono text-xs">008_categories.sql</code> in Supabase
          if this page is empty after deploy.
        </p>
      </header>
      <CategoryManager tree={tree} />
    </div>
  );
}
