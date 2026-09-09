import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/**
 * Destination Georgia sales tax (where the order ships).
 * Combined state + local. Other states: $0 until nexus is registered there.
 */
const GA_DEFAULT_RATE = 0.07;
const GA_ATLANTA_RATE = 0.089;
const GA_GWINNETT_RATE = 0.06;

function zipDigits(postalCode: string | null | undefined): string {
  return (postalCode ?? "").replace(/\D/g, "");
}

function zipLooksLikeGeorgia(postalCode: string | null | undefined): boolean {
  const prefix = Number(zipDigits(postalCode).slice(0, 3));
  if (!Number.isFinite(prefix)) return false;
  return (prefix >= 300 && prefix <= 319) || (prefix >= 398 && prefix <= 399);
}

function stateLooksLikeGeorgia(state: string | null | undefined): boolean {
  const value = state?.trim().toLowerCase().replace(/\./g, "") ?? "";
  if (!value) return false;
  if (value === "ga" || value === "georgia") return true;
  return /^(ga|georgia)(\s|,|-|$)/.test(value);
}

export function isGeorgia(
  state: string | null | undefined,
  postalCode?: string | null
): boolean {
  return stateLooksLikeGeorgia(state) || zipLooksLikeGeorgia(postalCode);
}

/** City of Atlanta combined rate (8.9%). 303/311 plus inner-metro ZIPs in the city. */
const ATLANTA_ZIPS = new Set([
  "30030",
  "30032",
  "30033",
  "30301",
  "30302",
  "30303",
  "30305",
  "30306",
  "30307",
  "30308",
  "30309",
  "30310",
  "30311",
  "30312",
  "30313",
  "30314",
  "30315",
  "30316",
  "30317",
  "30318",
  "30319",
  "30321",
  "30322",
  "30324",
  "30325",
  "30326",
  "30327",
  "30329",
  "30331",
  "30332",
  "30334",
  "30342",
  "30344",
  "30354",
  "30361",
  "30363",
]);

/** Gwinnett County combined rate (6%). */
const GWINNETT_ZIPS = new Set([
  "30011",
  "30017",
  "30019",
  "30024",
  "30039",
  "30043",
  "30044",
  "30045",
  "30046",
  "30047",
  "30049",
  "30052",
  "30071",
  "30078",
  "30092",
  "30093",
  "30095",
  "30096",
]);

export function georgiaTaxRate(postalCode: string | null | undefined): number {
  const zip = zipDigits(postalCode);
  const five = zip.slice(0, 5);
  if (zip.startsWith("303") || zip.startsWith("311") || ATLANTA_ZIPS.has(five)) {
    return GA_ATLANTA_RATE;
  }
  if (GWINNETT_ZIPS.has(five)) return GA_GWINNETT_RATE;
  return GA_DEFAULT_RATE;
}

export function estimateSalesTax(input: {
  taxableAmount: number;
  state?: string | null;
  postalCode?: string | null;
}): number {
  if (input.taxableAmount <= 0) return 0;
  if (!isGeorgia(input.state, input.postalCode)) return 0;
  const rate = georgiaTaxRate(input.postalCode) || GA_DEFAULT_RATE;
  const tax = Math.round(input.taxableAmount * rate * 100) / 100;
  // Georgia shipments with a taxable total must collect tax — never silently $0.00.
  if (tax > 0) return tax;
  return Math.max(0.01, Math.round(input.taxableAmount * GA_DEFAULT_RATE * 100) / 100);
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
