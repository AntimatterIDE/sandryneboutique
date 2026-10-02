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

export type PaidShippingCarrier = "UPS" | "FedEx";

/**
 * Carrier the customer actually paid for.
 * Returns null when the order did not save a service — do not assume UPS.
 */
export function paidShippingCarrier(
  service?: string | null,
  code?: string | null
): PaidShippingCarrier | null {
  const savedCode = (code ?? "").trim();
  const savedName = service ?? "";
  if (isFedExServiceCode(savedCode) || /fedex/i.test(`${savedName} ${savedCode}`)) return "FedEx";
  if (/^ups\b/i.test(savedName.trim()) || /^\d{2}$/.test(savedCode)) return "UPS";
  if (/\bups\b/i.test(savedName)) return "UPS";
  return null;
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

export interface QuotedShippingRate {
  amount: number;
  code: string;
  name: string;
  arrives?: string | null;
}

export interface FeaturedShippingOption {
  amount: number;
  code: string;
  name: string;
  headline: string;
  detail: string;
  estimate: string;
}

/** Next weekday ship date in Cumming, GA, as YYYY-MM-DD. */
export function nextShipDate(from = new Date()): string {
  let cursor = from;
  for (let i = 0; i < 8; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(cursor);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (weekday !== "Sat" && weekday !== "Sun" && year && month && day) {
      return `${year}-${month}-${day}`;
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(from);
}

export function addBusinessDays(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const cursor = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  let left = Math.max(0, days);
  while (left > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}

export function formatArrivalEstimate(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `Arrives ${formatted}`;
}

/** Express and deferred air have a fixed transit. Ground depends on the destination. */
function fixedTransitBusinessDays(code: string): number | null {
  switch (shippingSpeedRank(code)) {
    case 1:
    case 2:
    case 3:
      return 1;
    case 4:
    case 5:
      return 2;
    case 6:
      return 3;
    default:
      return null;
  }
}

export function shippingArrivalEstimate(code: string, arrives?: string | null): string {
  const dated = arrives ? formatArrivalEstimate(arrives) : null;
  if (dated) return dated;
  const days = fixedTransitBusinessDays(code);
  if (days == null) return "Arrives in 1–5 business days";
  return formatArrivalEstimate(addBusinessDays(nextShipDate(), days)) ?? "Arrives in 1–5 business days";
}

/** Cheapest, best-priced middle speed, fastest, and lowest-emission. One service is listed once. */
export function selectFeaturedShippingOptions(rates: QuotedShippingRate[]): FeaturedShippingOption[] {
  const unique: QuotedShippingRate[] = [];
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
  const taken = new Set([cheapest.code, fastest.code]);
  const fasterThanCheap = shippingSpeedRank(cheapest.code);
  const slowerThanFast = shippingSpeedRank(fastest.code);
  const between = unique.filter((rate) => {
    if (taken.has(rate.code)) return false;
    const rank = shippingSpeedRank(rate.code);
    return rank > slowerThanFast && rank < fasterThanCheap;
  });
  const middle = [...between].sort(
    (a, b) => a.amount - b.amount || shippingSpeedRank(a.code) - shippingSpeedRank(b.code)
  )[0];

  assign(cheapest, "Cheapest");
  assign(eco, "Eco-friendly");
  if (middle) assign(middle, "Middle");
  assign(fastest, "Fastest");

  const picked: FeaturedShippingOption[] = [];
  const pickedCodes = new Set<string>();
  for (const rate of [cheapest, eco, middle, fastest]) {
    if (!rate || pickedCodes.has(rate.code)) continue;
    pickedCodes.add(rate.code);
    const headline = (labels.get(rate.code) ?? []).join(" · ");
    const estimate = shippingArrivalEstimate(rate.code, rate.arrives);
    picked.push({
      amount: rate.amount,
      code: rate.code,
      detail: rate.name,
      estimate,
      headline,
      name: `${headline} · ${rate.name}`,
    });
  }
  return picked.sort(
    (a, b) => shippingSpeedRank(b.code) - shippingSpeedRank(a.code) || a.amount - b.amount
  );
}
