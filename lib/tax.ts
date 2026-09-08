import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/** Destination-based Georgia sales tax. Other states: no nexus collected yet. */
const GA_DEFAULT_RATE = 0.07;
const GA_ATLANTA_RATE = 0.089;

export function isGeorgia(state: string | null | undefined): boolean {
  const value = state?.trim().toLowerCase() ?? "";
  return value === "ga" || value === "georgia";
}

export function georgiaTaxRate(postalCode: string | null | undefined): number {
  const zip = (postalCode ?? "").replace(/\D/g, "");
  if (zip.startsWith("303") || zip.startsWith("311")) return GA_ATLANTA_RATE;
  return GA_DEFAULT_RATE;
}

export function estimateSalesTax(input: {
  taxableAmount: number;
  state?: string | null;
  postalCode?: string | null;
}): number {
  if (input.taxableAmount <= 0) return 0;
  if (!isGeorgia(input.state)) return 0;
  const rate = georgiaTaxRate(input.postalCode);
  return Math.round(input.taxableAmount * rate * 100) / 100;
}

export function shippingForSubtotal(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
}

export function checkoutTotals(input: {
  subtotal: number;
  discount?: number;
  state?: string | null;
  postalCode?: string | null;
}): { discountedSubtotal: number; shipping: number; tax: number; total: number } {
  const discountedSubtotal = Math.max(0, Math.round((input.subtotal - (input.discount ?? 0)) * 100) / 100);
  const shipping = shippingForSubtotal(discountedSubtotal);
  const tax = estimateSalesTax({
    taxableAmount: discountedSubtotal + shipping,
    state: input.state,
    postalCode: input.postalCode,
  });
  const total = Math.round((discountedSubtotal + shipping + tax) * 100) / 100;
  return { discountedSubtotal, shipping, tax, total };
}
