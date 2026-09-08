"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TrustBadges } from "@/components/product/trust-badges";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { formatPrice } from "@/lib/types";
import { cartLineKey, cartSubtotal, useCart } from "@/lib/store/cart";
import { useHydrated } from "@/lib/hooks/use-hydrated";

export function CartDrawer() {
  const { items, isOpen, closeCart, openCart, removeItem, setQuantity } = useCart();
  const hydrated = useHydrated();

  const subtotal = cartSubtotal(items);
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? openCart() : closeCart())}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md p-0">
        <SheetHeader className="px-6 py-5 border-b border-foreground/8">
          <SheetTitle className="font-serif text-xl tracking-[0.18em] uppercase font-normal">
            Cart{hydrated && items.length > 0 ? ` (${items.reduce((n, i) => n + i.quantity, 0)})` : ""}
          </SheetTitle>
        </SheetHeader>

        {!hydrated || items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
            <p className="font-serif text-2xl">Your cart is empty</p>
            <p className="text-sm text-muted-foreground text-center max-w-60">
              Be first to wear the story — explore this week&apos;s fresh picks.
            </p>
            <Button asChild variant="outline" className="rounded-none tracking-[0.18em] uppercase text-xs" onClick={closeCart}>
              <Link href="/shop?category=new-arrivals">Explore New Arrivals</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-foreground/8">
              <p className="text-xs text-muted-foreground mb-2">
                {remaining > 0 ? (
                  <>
                    You are <span className="text-foreground font-medium">{formatPrice(remaining)}</span> away
                    from free shipping
                  </>
                ) : (
                  <span className="text-foreground font-medium">
                    Congratulations! Your order qualifies for free shipping.
                  </span>
                )}
              </p>
              <div className="h-px bg-border relative">
                <div
                  className="absolute inset-y-0 left-0 bg-foreground transition-[width] duration-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 divide-y divide-foreground/8">
              {items.map((item) => {
                const key = cartLineKey(item);
                return (
                  <div key={key} className="flex gap-4 py-5">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeCart}
                      className="relative w-20 h-26 shrink-0 overflow-hidden bg-muted"
                    >
                      {item.image && (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/products/${item.slug}`}
                            onClick={closeCart}
                            className="text-sm font-medium leading-snug line-clamp-2"
                          >
                            {item.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[item.size, item.color].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => removeItem(key)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-foreground/15">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setQuantity(key, item.quantity - 1)}
                            className="p-1.5 hover:bg-muted transition-colors"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="w-8 text-center text-xs tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQuantity(key, item.quantity + 1)}
                            disabled={item.quantity >= item.maxQuantity}
                            className="p-1.5 hover:bg-muted transition-colors disabled:opacity-30"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <span className="text-sm tabular-nums">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-foreground/8 px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                  Subtotal
                </span>
                <span className="font-medium tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping, Georgia sales tax, and discount codes are calculated at checkout.
              </p>
              <Button
                asChild
                className="w-full rounded-none h-12 tracking-[0.22em] uppercase text-xs"
                onClick={closeCart}
              >
                <Link href="/checkout">Check Out</Link>
              </Button>
              <TrustBadges className="justify-center pt-1" />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
