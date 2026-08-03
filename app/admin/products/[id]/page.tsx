import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { getCategoryTree } from "@/lib/data/categories";
import { getVariantsByProductIds } from "@/lib/data/products";
import { createPrivilegedClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Edit Product",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createPrivilegedClient();
  const [{ data }, categoryTree] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    getCategoryTree(),
  ]);
  const product = data as Product | null;
  if (!product) notFound();

  const variants = await getVariantsByProductIds([product.id]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Edit Product</h1>
        <p className="text-sm text-muted-foreground mt-1">{product.name}</p>
      </header>
      <ProductForm
        product={{
          ...product,
          subcategory: product.subcategory ?? null,
          variants: variants.get(product.id) ?? [],
        }}
        categoryTree={categoryTree}
      />
    </div>
  );
}
