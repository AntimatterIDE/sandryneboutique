import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/** Destination-based Georgia sales tax. Other states: no nexus collected yet. */
const GA_DEFAULT_RATE = 0.07;
const GA_ATLANTA_RATE = 0.089;

function zipDigits(postalCode: string | null | undefined): string {
  return (postalCode ?? "").replace(/\D/g, "");
}

function zipLooksLikeGeorgia(postalCode: string | null | undefined): boolean {
  const prefix = Number(zipDigits(postalCode).slice(0, 3));
  if (!Number.isFinite(prefix)) return false;
  return (prefix >= 300 && prefix <= 319) || (prefix >= 398 && prefix <= 399);
}

export function isGeorgia(
  state: string | null | undefined,
  postalCode?: string | null
): boolean {
  const value = state?.trim().toLowerCase().replace(/\./g, "") ?? "";
  if (value === "ga" || value === "georgia") return true;
  return zipLooksLikeGeorgia(postalCode);
}

export function georgiaTaxRate(postalCode: string | null | undefined): number {
  const zip = zipDigits(postalCode);
  if (zip.startsWith("303") || zip.startsWith("311")) return GA_ATLANTA_RATE;
  return GA_DEFAULT_RATE;
}

export function estimateSalesTax(input: {
  taxableAmount: number;
  state?: string | null;
  postalCode?: string | null;
}): number {
  if (input.taxableAmount <= 0) return 0;
  if (!isGeorgia(input.state, input.postalCode)) return 0;
  const rate = georgiaTaxRate(input.postalCode);
  return Math.round(input.taxableAmount * rate * 100) / 100;
}

export function shippingForSubtotal(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
}

export function isAddressQuotable(address: {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): boolean {
  return Boolean(
    address.line1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      (address.postal_code ?? "").replace(/\D/g, "").length >= 5 &&
      address.country?.trim()
  );
}

export function checkoutTotals(input: {
  subtotal: number;
  discount?: number;
  state?: string | null;
  postalCode?: string | null;
  /** Live UPS (or fallback) amount. Omit to use the flat rate. */
  shippingAmount?: number;
}): { discountedSubtotal: number; shipping: number; tax: number; total: number } {
  const discountedSubtotal = Math.max(0, Math.round((input.subtotal - (input.discount ?? 0)) * 100) / 100);
  const shipping =
    input.shippingAmount != null
      ? Math.max(0, Math.round(input.shippingAmount * 100) / 100)
      : shippingForSubtotal(discountedSubtotal);
  const tax = estimateSalesTax({
    taxableAmount: discountedSubtotal + shipping,
    state: input.state,
    postalCode: input.postalCode,
  });
  const total = Math.round((discountedSubtotal + shipping + tax) * 100) / 100;
  return { discountedSubtotal, shipping, tax, total };
}
