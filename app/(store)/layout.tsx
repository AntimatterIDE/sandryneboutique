import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { PromoBar } from "@/components/layout/promo-bar";
import { Footer } from "@/components/layout/footer";
import { CartDrawerLazy } from "@/components/cart/cart-drawer-lazy";
import { getMegaMenuProducts } from "@/lib/data/products";

export default async function StoreLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const menu = await getMegaMenuProducts();

  return (
    <>
      <PromoBar />
      <Suspense fallback={<header className="h-20 border-b border-foreground/8" />}>
        <Header menu={menu} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawerLazy />
    </>
  );
}
