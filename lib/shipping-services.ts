/** Client-safe shipping service helpers. Do not import server shipping APIs here. */

export const FEDEX_CHECKOUT_SERVICES = new Set([
  "FEDEX_GROUND",
  "GROUND_HOME_DELIVERY",
  "FEDEX_EXPRESS_SAVER",
  "FEDEX_2_DAY",
  "FEDEX_2_DAY_AM",
  "STANDARD_OVERNIGHT",
  "PRIORITY_OVERNIGHT",
  "FIRST_OVERNIGHT",
]);

export function isFedExServiceCode(code: string | null | undefined): boolean {
  const value = (code ?? "").trim().toUpperCase();
  return FEDEX_CHECKOUT_SERVICES.has(value) || value.startsWith("FEDEX_");
}

/** Ground options that become free when the cart qualifies. */
export function isFreeEligibleShippingService(code: string): boolean {
  const value = code.trim().toUpperCase();
  return value === "03" || value === "FLAT" || value === "FEDEX_GROUND" || value === "GROUND_HOME_DELIVERY";
}
