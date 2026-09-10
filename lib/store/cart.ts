"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  /** Heartland size/color variant id when linked; null for legacy products. */
  variantId: string | null;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  size: string | null;
  color: string | null;
  heartlandPublicId?: string | null;
  quantity: number;
  maxQuantity: number;
  /** Sale-priced items are final sale. */
  finalSale?: boolean;
}

export function cartLineKey(
  item: Pick<CartItem, "variantId" | "productId" | "size" | "color">
): string {
  if (item.variantId) return `variant::${item.variantId}`;
  return `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (lineKey: string) => void;
  setQuantity: (lineKey: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      addItem: (item, quantity = 1) =>
        set((state) => {
          const key = cartLineKey(item);
          const existing = state.items.find((i) => cartLineKey(i) === key);
          if (existing) {
            return {
              isOpen: true,
              items: state.items.map((i) =>
                cartLineKey(i) === key
                  ? {
                      ...i,
                      quantity: Math.min(i.quantity + quantity, i.maxQuantity),
                      finalSale: Boolean(i.finalSale || item.finalSale),
                    }
                  : i
              ),
            };
          }
          return {
            isOpen: true,
            items: [...state.items, { ...item, quantity: Math.min(quantity, item.maxQuantity) }],
          };
        }),
      removeItem: (lineKey) =>
        set((state) => ({
          items: state.items.filter((i) => cartLineKey(i) !== lineKey),
        })),
      setQuantity: (lineKey, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => cartLineKey(i) !== lineKey)
              : state.items.map((i) =>
                  cartLineKey(i) === lineKey
                    ? { ...i, quantity: Math.min(quantity, i.maxQuantity) }
                    : i
                ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "sandryne-cart-v2",
      partialize: (state) => ({ items: state.items }),
      version: 3,
      migrate: (persisted) => {
        const state = persisted as { items?: CartItem[] } | undefined;
        return {
          items: (state?.items ?? []).map((item) => ({
            ...item,
            finalSale: Boolean(item.finalSale),
          })),
        };
      },
    }
  )
);

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
