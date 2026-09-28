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

/** Ground service, excluding the flat fallback. Trucks emit less than air. */
export function isEcoFriendlyShippingService(code: string): boolean {
  const value = code.trim().toUpperCase();
  return value === "03" || value === "FEDEX_GROUND" || value === "GROUND_HOME_DELIVERY";
}

/** Lower is faster. Ranks published UPS and FedEx service speeds. */
export function shippingSpeedRank(code: string): number {
  switch (code.trim().toUpperCase()) {
    case "14":
    case "FIRST_OVERNIGHT":
      return 1;
    case "01":
    case "PRIORITY_OVERNIGHT":
      return 2;
    case "13":
    case "STANDARD_OVERNIGHT":
      return 3;
    case "59":
    case "FEDEX_2_DAY_AM":
      return 4;
    case "02":
    case "FEDEX_2_DAY":
      return 5;
    case "12":
    case "FEDEX_EXPRESS_SAVER":
      return 6;
    case "03":
    case "FEDEX_GROUND":
    case "GROUND_HOME_DELIVERY":
    case "FLAT":
      return 8;
    default:
      return 7;
  }
}

export interface FeaturedShippingOption {
  amount: number;
  code: string;
  name: string;
  headline: string;
  detail: string;
}

/** Cheapest, fastest, and lowest-emission choices. One service is listed once when it fills two roles. */
export function selectFeaturedShippingOptions(
  rates: { amount: number; code: string; name: string }[]
): FeaturedShippingOption[] {
  const unique: { amount: number; code: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const rate of rates) {
    const code = rate.code.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    unique.push(rate);
  }
  if (unique.length === 0) return [];

  const cheapest = [...unique].sort(
    (a, b) => a.amount - b.amount || shippingSpeedRank(b.code) - shippingSpeedRank(a.code)
  )[0];
  const fastest = [...unique].sort(
    (a, b) => shippingSpeedRank(a.code) - shippingSpeedRank(b.code) || a.amount - b.amount
  )[0];
  const ground = unique.filter((rate) => isEcoFriendlyShippingService(rate.code));
  const eco = (ground.length > 0 ? ground : unique).slice().sort((a, b) => {
    if (ground.length === 0) {
      const speed = shippingSpeedRank(b.code) - shippingSpeedRank(a.code);
      if (speed !== 0) return speed;
    }
    return a.amount - b.amount || shippingSpeedRank(b.code) - shippingSpeedRank(a.code);
  })[0];

  const labels = new Map<string, string[]>();
  const assign = (rate: { code: string }, label: string) => {
    const current = labels.get(rate.code) ?? [];
    if (!current.includes(label)) current.push(label);
    labels.set(rate.code, current);
  };
  assign(cheapest, "Cheapest");
  assign(eco, "Eco-friendly");
  assign(fastest, "Fastest");

  const picked: FeaturedShippingOption[] = [];
  const pickedCodes = new Set<string>();
  for (const rate of [cheapest, eco, fastest]) {
    if (pickedCodes.has(rate.code)) continue;
    pickedCodes.add(rate.code);
    const headline = (labels.get(rate.code) ?? []).join(" · ");
    picked.push({
      amount: rate.amount,
      code: rate.code,
      detail: rate.name,
      headline,
      name: `${headline} · ${rate.name}`,
    });
  }
  return picked;
}
