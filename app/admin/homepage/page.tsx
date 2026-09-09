import type { Metadata } from "next";
import { HomepageSectionForm } from "@/components/admin/homepage-section-form";
import { getHomepageSections } from "@/lib/data/homepage";
import { createPrivilegedClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/data/products";
import type { Product } from "@/lib/types";

export const metadata: Metadata = {
  title: "Homepage",
};

export default async function AdminHomepagePage() {
  const sections = await getHomepageSections();

  let products: Product[] = [];
  if (supabaseConfigured()) {
    const supabase = await createPrivilegedClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    products = (data ?? []) as Product[];
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Homepage</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Change the homepage hero photo, then curate the featured carousel and
          new-arrivals grid. Empty product lists auto-fill from the catalog.
        </p>
      </header>

      <div className="space-y-6">
        {sections.map((section) => (
          <HomepageSectionForm key={section.id} section={section} products={products} />
        ))}
      </div>
    </div>
  );
}
