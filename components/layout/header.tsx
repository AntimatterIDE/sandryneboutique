"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { CATEGORIES } from "@/lib/constants";
import type { MenuProduct } from "@/lib/data/products";
import { shopHref } from "@/lib/shop";
import { cartCount, useCart } from "@/lib/store/cart";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { formatPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeaderProps {
  menu?: Record<string, MenuProduct[]>;
}

export function Header({ menu = {} }: HeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const items = useCart((s) => s.items);
  const openCart = useCart((s) => s.openCart);
  const hydrated = useHydrated();
  const shopCategory = pathname === "/shop" ? searchParams.get("category") : null;

  // Cart is persisted in localStorage; defer count to after hydration.
  const count = hydrated ? cartCount(items) : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Close menus on navigation.
  useEffect(() => {
    setMenuOpen(false);
    setActiveCategory(null);
  }, [pathname, searchParams]);

  const closeMenu = () => setMenuOpen(false);
  const activeProducts = activeCategory ? menu[activeCategory] ?? [] : [];
  const activeDef = CATEGORIES.find((c) => c.slug === activeCategory);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-shadow duration-300 glass",
          scrolled && "shadow-[0_1px_24px_rgba(0,0,0,0.06)]"
        )}
        onMouseLeave={() => setActiveCategory(null)}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-3 items-center h-16">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((v) => !v)}
                className="lg:hidden p-2 -ml-2"
              >
                {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>

            <Link href="/" aria-label="Sandryne Boutique" className="justify-self-center">
              <Image
                src="/brand/sandryne-black.png"
                alt="Sandryne Boutique"
                width={1303}
                height={419}
                sizes="160px"
                priority
                className="h-8 w-auto sm:h-10"
              />
            </Link>

            <div className="justify-self-end flex items-center gap-1 sm:gap-3">
              <Link href="/account" aria-label="Account" className="p-2 hover:opacity-60 transition-opacity">
                <User className="size-5" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                aria-label="Open cart"
                onClick={openCart}
                className="relative p-2 hover:opacity-60 transition-opacity"
              >
                <ShoppingBag className="size-5" strokeWidth={1.5} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-foreground text-background text-[10px] tabular-nums">
                    {count > 99 ? "99" : count}
                  </span>
                )}
              </button>
            </div>
          </div>

          <nav aria-label="Main navigation" className="hidden lg:flex items-center justify-center gap-8 pb-3.5">
            {CATEGORIES.map((cat) => {
              const href = shopHref({ category: cat.slug });
              const active = shopCategory === cat.slug || activeCategory === cat.slug;
              return (
                <Link
                  key={cat.slug}
                  href={href}
                  onMouseEnter={() => setActiveCategory(cat.slug)}
                  onFocus={() => setActiveCategory(cat.slug)}
                  className={cn(
                    "relative text-[11px] tracking-[0.18em] uppercase transition-opacity hover:opacity-100",
                    active ? "opacity-100" : "opacity-60",
                    cat.slug === "sale" && "text-destructive opacity-90"
                  )}
                >
                  {cat.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-1 left-0 right-0 h-px bg-foreground"
                    />
                  )}
                </Link>
              );
            })}
            <Link
              href="/blog"
              onMouseEnter={() => setActiveCategory(null)}
              className={cn(
                "relative text-[11px] tracking-[0.18em] uppercase transition-opacity hover:opacity-100",
                pathname.startsWith("/blog") ? "opacity-100" : "opacity-60"
              )}
            >
              Journal
              {pathname.startsWith("/blog") && (
                <motion.span
                  layoutId="nav-underline"
                  className="absolute -bottom-1 left-0 right-0 h-px bg-foreground"
                />
              )}
            </Link>
          </nav>
        </div>

        <AnimatePresence>
          {activeCategory && activeProducts.length > 0 && (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              role="navigation"
              aria-label={`${activeDef?.label ?? "Category"} menu`}
              className="hidden lg:block absolute inset-x-0 top-full border-t border-foreground/8 bg-background/98 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.08)]"
            >
              <div className="mx-auto max-w-7xl px-6 py-8">
                <div className="flex items-end justify-between mb-6">
                  <div>
                    <p className="font-serif text-xl tracking-tight">{activeDef?.label}</p>
                    {activeDef?.description && (
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {activeDef.description}
                      </p>
                    )}
                  </div>
                  <Link
                    href={shopHref({ category: activeCategory })}
                    className="text-[11px] tracking-[0.18em] uppercase border-b border-foreground/40 pb-0.5 hover:border-foreground transition-colors whitespace-nowrap"
                  >
                    Shop All
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  {activeProducts.map((product) => (
                    <Link
                      key={product.slug}
                      href={`/products/${product.slug}`}
                      className="group block"
                    >
                      <div className="relative aspect-3/4 overflow-hidden bg-muted">
                        {product.image && (
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="240px"
                            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                          />
                        )}
                      </div>
                      <h3 className="mt-3 text-sm leading-snug group-hover:underline underline-offset-4">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {product.description}
                      </p>
                      <div className="mt-1.5 flex items-baseline gap-2 text-sm">
                        <span
                          className={cn(
                            "tabular-nums",
                            product.compareAtPrice && "text-destructive"
                          )}
                        >
                          {formatPrice(product.price)}
                        </span>
                        {product.compareAtPrice && (
                          <span className="text-muted-foreground line-through tabular-nums text-xs">
                            {formatPrice(product.compareAtPrice)}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {menuOpen && (
            <nav
              aria-label="Mobile navigation"
              className="lg:hidden border-t border-foreground/8 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <ul className="px-6 py-6 flex flex-col gap-1">
                {CATEGORIES.map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={shopHref({ category: cat.slug })}
                      onClick={closeMenu}
                      className={cn(
                        "block py-2.5 font-serif text-2xl tracking-wide",
                        cat.slug === "sale" && "text-destructive",
                      )}
                    >
                      {cat.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/blog"
                    onClick={closeMenu}
                    className="block py-2.5 font-serif text-2xl tracking-wide"
                  >
                    Journal
                  </Link>
                </li>
              </ul>
            </nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
