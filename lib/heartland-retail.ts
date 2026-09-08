import "server-only";

/**
 * Heartland Retail POS REST client.
 * Docs: https://dev.retail.heartland.us/
 * Base: https://{subdomain}.retail.heartland.us/api
 */

export interface HeartlandRetailItem {
  id: number;
  public_id: string | null;
  description: string;
  long_description: string | null;
  price: number;
  cost: number;
  active: boolean;
  /** Present when the item belongs to an Item Grid. */
  grid_id?: number | null;
  /** Custom field bag — size/color usually live here. */
  custom?: Record<string, unknown> | null;
}

export interface HeartlandGridVariant {
  heartland_item_id: number;
  heartland_public_id: string;
  heartland_grid_id: number | null;
  size: string | null;
  color: string | null;
  price: number;
  inventory_count: number;
  active: boolean;
  description: string;
  sort_order: number;
}

export interface HeartlandGridLookup {
  /** Clean style name without size/color suffixes. */
  name: string;
  description: string;
  price: number;
  inventory_count: number;
  heartland_grid_id: number | null;
  /** Mapped storefront category slug when Heartland custom.category is known. */
  category: string | null;
  vendor: string | null;
  style: string | null;
  sizes: string[];
  colors: string[];
  variants: HeartlandGridVariant[];
}

const GENERIC_STYLE_NAMES = new Set([
  "top",
  "tops",
  "dress",
  "dresses",
  "jean",
  "jeans",
  "pant",
  "pants",
  "tee",
  "skirt",
  "blouse",
  "sweater",
  "cardigan",
  "jacket",
  "vest",
  "short",
  "shorts",
  "belt",
  "bag",
  "handbag",
  "cami",
  "tank",
]);

const HEARTLAND_CATEGORY_MAP: Record<string, string> = {
  tops: "tops",
  top: "tops",
  bottoms: "bottoms",
  bottom: "bottoms",
  dresses: "dresses",
  dress: "dresses",
  "active wear": "active-wear",
  "active-wear": "active-wear",
  activewear: "active-wear",
  accessories: "accessories-jewelry",
  jewelry: "accessories-jewelry",
  "accessories & jewelry": "accessories-jewelry",
  "accessories-jewelry": "accessories-jewelry",
};

export function mapHeartlandCategory(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return HEARTLAND_CATEGORY_MAP[raw.trim().toLowerCase()] ?? null;
}

/** Prefer vendor + style when Heartland only stores a generic garment type like "TOP". */
export function buildHeartlandProductName(
  parsedName: string,
  custom?: Record<string, unknown> | null
): string {
  const base = parsedName.trim() || "Untitled";
  const vendor = customString(custom, ["vendor", "Vendor"]);
  const style = customString(custom, ["style1", "Style1", "style", "Style"]);
  const isGeneric = GENERIC_STYLE_NAMES.has(base.toLowerCase());

  if (isGeneric && vendor && style) return `${vendor} ${base} ${style}`;
  if (isGeneric && style) return `${base} ${style}`;
  if (isGeneric && vendor) return `${vendor} ${base}`;
  return base;
}

const SIZE_ORDER = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "0",
  "2",
  "4",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "18",
  "20",
  "22",
  "24",
  "26",
  "28",
  "30",
  "32",
];

function sizeRank(size: string | null): number {
  if (!size) return 999;
  const idx = SIZE_ORDER.indexOf(size.toUpperCase());
  return idx === -1 ? 500 : idx;
}

function customString(
  custom: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!custom) return null;
  for (const key of keys) {
    const direct = custom[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const lower = Object.entries(custom).find(
      ([k, v]) => k.toLowerCase() === key.toLowerCase() && typeof v === "string"
    );
    if (lower && typeof lower[1] === "string" && lower[1].trim()) {
      return lower[1].trim();
    }
  }
  return null;
}

/**
 * Heartland descriptions often look like:
 *   JODIE MAXI - 31400RB - M - WHOLE GRAIN
 * → name, style code, size, color.
 */
export function parseHeartlandDescription(description: string): {
  name: string;
  size: string | null;
  color: string | null;
} {
  const parts = description
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 4) {
    return {
      name: parts[0],
      size: parts[parts.length - 2] || null,
      color: parts[parts.length - 1] || null,
    };
  }
  if (parts.length === 3) {
    // NAME - SIZE - COLOR (no style code)
    return { name: parts[0], size: parts[1] || null, color: parts[2] || null };
  }
  return { name: description.trim() || "Untitled", size: null, color: null };
}

export function extractVariantOptions(item: HeartlandRetailItem): {
  name: string;
  size: string | null;
  color: string | null;
} {
  const parsed = parseHeartlandDescription(item.description || "");
  const size =
    parsed.size ??
    customString(item.custom, ["size", "Size", "SIZE", "style1", "Style1"]);
  const color =
    parsed.color ??
    customString(item.custom, ["color", "Color", "colour", "Colour", "COLOR"]);
  return { name: parsed.name, size, color };
}

export interface HeartlandInventoryValue {
  item_id: number;
  location_id?: number;
  qty_available?: number;
  qty_on_hand?: number;
  qty?: number;
  qty_committed?: number;
}

export interface HeartlandCustomer {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  name: string | null;
}

interface SearchResult<T> {
  total: number;
  pages: number;
  results: T[];
}

/** True when the admin search box likely contains a Heartland Item # / id. */
export function looksLikeHeartlandItemQuery(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^\d{3,}$/.test(trimmed)) return true;
  // Public ids / barcodes that include digits (e.g. mixed codes).
  return /^[A-Za-z0-9._-]{3,40}$/.test(trimmed) && /\d/.test(trimmed);
}

export function heartlandRetailConfigured(): boolean {
  const station = Number(process.env.HEARTLAND_RETAIL_STATION_ID);
  const location = Number(process.env.HEARTLAND_RETAIL_LOCATION_ID);
  const paymentType = Number(process.env.HEARTLAND_RETAIL_WEB_PAYMENT_TYPE);
  return Boolean(
    process.env.HEARTLAND_RETAIL_SUBDOMAIN &&
      process.env.HEARTLAND_RETAIL_API_TOKEN &&
      Number.isFinite(station) &&
      station > 0 &&
      Number.isFinite(location) &&
      location > 0 &&
      Number.isFinite(paymentType) &&
      paymentType > 0
  );
}

function baseUrl(): string {
  const subdomain = process.env.HEARTLAND_RETAIL_SUBDOMAIN!;
  return `https://${subdomain}.retail.heartland.us/api`;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.HEARTLAND_RETAIL_API_TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function parseLocationId(location: string | null): number {
  if (!location) throw new Error("Heartland Retail response missing Location header.");
  const match = location.match(/\/(\d+)\s*$/);
  if (!match) throw new Error(`Could not parse Retail id from Location: ${location}`);
  return Number(match[1]);
}

async function retailFetch(
  path: string,
  init?: RequestInit
): Promise<{ res: Response; body: unknown }> {
  const url = path.startsWith("http") ? path : `${baseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail =
      typeof body === "object" && body !== null
        ? JSON.stringify(body)
        : String(body ?? res.statusText);
    throw new Error(`Heartland Retail ${init?.method ?? "GET"} ${path} → ${res.status}: ${detail}`);
  }

  return { res, body };
}

export async function getItem(itemId: number): Promise<HeartlandRetailItem> {
  const { body } = await retailFetch(`/items/${itemId}?_include[]=grid`);
  return body as HeartlandRetailItem;
}

export async function searchItemsByPublicId(
  publicId: string
): Promise<HeartlandRetailItem[]> {
  const filter = encodeURIComponent(JSON.stringify({ public_id: publicId }));
  const { body } = await retailFetch(
    `/items?_filter[]=${filter}&per_page=10&_include[]=grid`
  );
  const result = body as SearchResult<HeartlandRetailItem>;
  return result.results ?? [];
}

/** Resolve many Item # values in one request. Keyed by public_id. */
export async function searchItemsByPublicIds(
  publicIds: string[]
): Promise<Map<string, HeartlandRetailItem>> {
  const found = new Map<string, HeartlandRetailItem>();
  const wanted = [...new Set(publicIds.filter((id) => id.trim()))];
  if (wanted.length === 0) return found;

  const filter = encodeURIComponent(JSON.stringify({ public_id: { $in: wanted } }));
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const { body } = await retailFetch(
      `/items?_filter[]=${filter}&per_page=100&page=${page}&_include[]=grid`
    );
    const result = body as SearchResult<HeartlandRetailItem>;
    for (const item of result.results ?? []) {
      if (item.public_id) found.set(String(item.public_id), item);
    }
    pages = Math.max(1, result.pages ?? 1);
    page += 1;
  }

  return found;
}

/** Every sellable item that belongs to a Heartland Item Grid. */
export async function searchItemsByGridId(
  gridId: number
): Promise<HeartlandRetailItem[]> {
  const filter = encodeURIComponent(JSON.stringify({ grid_id: gridId }));
  const items: HeartlandRetailItem[] = [];
  let page = 1;
  let pages = 1;

  while (page <= pages) {
    const { body } = await retailFetch(
      `/items?_filter[]=${filter}&per_page=100&page=${page}&_include[]=grid`
    );
    const result = body as SearchResult<HeartlandRetailItem>;
    items.push(...(result.results ?? []));
    pages = Math.max(1, result.pages ?? 1);
    page += 1;
  }

  return items;
}

/**
 * Resolve an Item # / internal id to the full Item Grid of size/color variants,
 * with live inventory for each sibling.
 */
export async function lookupItemGrid(rawId: string): Promise<HeartlandGridLookup | null> {
  const trimmed = rawId.trim();
  if (!trimmed) return null;

  const matches = await searchItemsByPublicId(trimmed);
  let seed =
    matches.find((match) => String(match.public_id ?? "") === trimmed) ?? matches[0];

  if (!seed && /^\d+$/.test(trimmed)) {
    try {
      seed = await getItem(Number(trimmed));
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes("→ 404:")) throw err;
    }
  }

  if (!seed) return null;

  const gridId =
    typeof seed.grid_id === "number" && seed.grid_id > 0 ? seed.grid_id : null;
  const siblings = gridId ? await searchItemsByGridId(gridId) : [seed];
  const items = siblings.length > 0 ? siblings : [seed];

  const qtyByItem = await getInventoryByItemIds(items.map((item) => item.id));

  const variants: HeartlandGridVariant[] = items
    .map((item) => {
      const opts = extractVariantOptions(item);
      return {
        heartland_item_id: item.id,
        heartland_public_id: String(item.public_id ?? item.id),
        heartland_grid_id: gridId,
        size: opts.size,
        color: opts.color,
        price: Number(item.price) || 0,
        inventory_count: qtyByItem.get(item.id) ?? 0,
        active: isHeartlandItemActive(item),
        description: (item.description || "").trim(),
        sort_order: sizeRank(opts.size),
      };
    })
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return (a.color ?? "").localeCompare(b.color ?? "");
    })
    .map((variant, index) => ({ ...variant, sort_order: index }));

  const seedOpts = extractVariantOptions(seed);
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];
  const inventory_count = variants.reduce((sum, v) => sum + v.inventory_count, 0);
  const price =
    variants.find((v) => v.heartland_item_id === seed.id)?.price ??
    (Number(seed.price) || 0);
  const vendor = customString(seed.custom, ["vendor", "Vendor"]);
  const style = customString(seed.custom, ["style1", "Style1", "style", "Style"]);
  const category = mapHeartlandCategory(
    customString(seed.custom, ["category", "Category"])
  );
  const name = buildHeartlandProductName(
    seedOpts.name || (seed.description || "").trim() || `Item ${seed.id}`,
    seed.custom
  );

  return {
    name,
    description: (seed.long_description || name || seed.description || "").trim(),
    price,
    inventory_count,
    heartland_grid_id: gridId,
    category,
    vendor,
    style,
    sizes,
    colors,
    variants,
  };
}

function isHeartlandItemActive(item: HeartlandRetailItem): boolean {
  const raw = item as HeartlandRetailItem & { "active?"?: boolean };
  if (typeof raw.active === "boolean") return raw.active;
  if (typeof raw["active?"] === "boolean") return raw["active?"];
  return true;
}

function numQty(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}

function inventoryRowQty(row: HeartlandInventoryValue): number {
  return numQty(row.qty_available ?? row.qty_on_hand ?? row.qty);
}

export interface HeartlandItemQty {
  available: number;
  onHand: number;
  committed: number;
}

async function getItemInventorySnapshot(itemId: number): Promise<HeartlandItemQty> {
  const locationId = Number(process.env.HEARTLAND_RETAIL_LOCATION_ID || 0);
  const params = new URLSearchParams();
  params.append("group[]", "item_id");
  if (locationId > 0) params.append("group[]", "location_id");
  params.set("per_page", "100");
  params.append("_filter[]", JSON.stringify({ item_id: itemId }));

  const { body } = await retailFetch(`/inventory/values?${params.toString()}`);
  const all = (body as SearchResult<HeartlandInventoryValue>).results ?? [];
  const rows = locationId > 0 ? all.filter((row) => row.location_id === locationId) : all;
  const use = rows.length > 0 ? rows : all;

  return use.reduce(
    (acc, row) => ({
      available: acc.available + inventoryRowQty(row),
      onHand: acc.onHand + numQty(row.qty_on_hand ?? row.qty),
      committed: acc.committed + numQty(row.qty_committed),
    }),
    { available: 0, onHand: 0, committed: 0 }
  );
}

/** Qty available for one item (all locations summed, or filtered to web location). */
export async function getItemQtyAvailable(itemId: number): Promise<number> {
  const snap = await getItemInventorySnapshot(itemId);
  return snap.available;
}

/**
 * Map of item_id → qty_available for the given ids.
 * Pages through inventory values grouped by item_id.
 */
export async function getInventoryByItemIds(
  itemIds: number[]
): Promise<Map<number, number>> {
  const wanted = new Set(itemIds);
  const map = new Map<number, number>();
  if (wanted.size === 0) return map;

  // Prefer per-item lookups when the set is small (admin / checkout).
  if (wanted.size <= 25) {
    await Promise.all(
      [...wanted].map(async (id) => {
        try {
          map.set(id, await getItemQtyAvailable(id));
        } catch (err) {
          console.error(`Retail inventory lookup failed for item ${id}:`, err);
          map.set(id, 0);
        }
      })
    );
    return map;
  }

  let page = 1;
  let pages = 1;
  while (page <= pages) {
    const params = new URLSearchParams();
    params.append("group[]", "item_id");
    params.set("per_page", "100");
    params.set("page", String(page));
    const { body } = await retailFetch(`/inventory/values?${params.toString()}`);
    const result = body as SearchResult<HeartlandInventoryValue>;
    pages = result.pages || 1;
    for (const row of result.results ?? []) {
      if (wanted.has(row.item_id)) {
        const prev = map.get(row.item_id) ?? 0;
        map.set(row.item_id, prev + inventoryRowQty(row));
      }
    }
    page += 1;
    if (map.size >= wanted.size) break;
  }

  for (const id of wanted) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

export async function findCustomerByEmail(email: string): Promise<HeartlandCustomer | null> {
  const variants = [...new Set([email.trim(), email.trim().toLowerCase()].filter(Boolean))];
  for (const value of variants) {
    const filter = encodeURIComponent(JSON.stringify({ email: value }));
    const { body } = await retailFetch(`/customers?_filter[]=${filter}&per_page=5`);
    const hits = (body as SearchResult<HeartlandCustomer>).results ?? [];
    if (hits[0]) return hits[0];
  }
  return null;
}

export async function createCustomer(input: {
  first_name: string;
  last_name: string;
  email: string;
}): Promise<number> {
  const { res } = await retailFetch("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseLocationId(res.headers.get("location"));
}

export async function upsertCustomerByEmail(input: {
  email: string;
  fullName: string;
}): Promise<number> {
  const existing = await findCustomerByEmail(input.email);
  if (existing) return existing.id;

  const parts = input.fullName.trim().split(/\s+/);
  const first_name = parts[0] || "Customer";
  const last_name = parts.slice(1).join(" ") || "Web";
  return createCustomer({
    first_name,
    last_name,
    email: input.email.toLowerCase(),
  });
}

function retailCountry(country: string): string {
  const trimmed = country.trim();
  if (/^(united states|usa|us)$/i.test(trimmed)) return "US";
  return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
}

export async function createCustomerAddress(
  customerId: number,
  address: {
    first_name?: string;
    last_name?: string;
    address_1: string;
    address_2?: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
  }
): Promise<number> {
  const payload = {
    first_name: address.first_name || "Customer",
    last_name: address.last_name || "Web",
    line_1: address.address_1,
    line_2: address.address_2 || null,
    city: address.city,
    state: address.state,
    postal_code: address.zip,
    country: retailCountry(address.country),
  };

  const { res } = await retailFetch(`/customers/${customerId}/addresses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const joinId = parseLocationId(res.headers.get("location"));

  try {
    const { body } = await retailFetch(`/customers/${customerId}/addresses/${joinId}`);
    const record = body as { id?: number; address_id?: number };
    return record.address_id ?? record.id ?? joinId;
  } catch {
    return joinId;
  }
}

export async function createSalesOrder(input: {
  customer_id: number;
  station_id: number;
  source_location_id: number;
  shipping_charge?: number;
  shipping_address_id?: number;
  billing_address_id?: number;
}): Promise<number> {
  try {
    const { res } = await retailFetch("/sales/orders", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return parseLocationId(res.headers.get("location"));
  } catch (err) {
    const { shipping_charge, shipping_address_id, billing_address_id, ...base } = input;
    void shipping_charge;
    void shipping_address_id;
    void billing_address_id;
    const { res } = await retailFetch("/sales/orders", {
      method: "POST",
      body: JSON.stringify(base),
    });
    return parseLocationId(res.headers.get("location"));
  }
}

export async function addOrderLine(
  orderId: number,
  input: { item_id: number; qty: number; adjusted_unit_price?: number }
): Promise<number> {
  const { res } = await retailFetch(`/sales/orders/${orderId}/lines`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseLocationId(res.headers.get("location"));
}

export async function distributeOrderLine(
  orderId: number,
  lineId: number,
  shipFromLocationId: number
): Promise<void> {
  await retailFetch(`/sales/orders/${orderId}/lines/${lineId}`, {
    method: "PUT",
    body: JSON.stringify({ ship_from_location_id: shipFromLocationId }),
  });
}

export async function addOrderPayment(
  orderId: number,
  input: {
    amount: number;
    payment_type_id: number;
    /** Portico transaction id for reconciliation */
    reference?: string;
  }
): Promise<number> {
  const amount = Math.round(input.amount * 100) / 100;
  const attempts: Record<string, unknown>[] = [
    {
      type: "CustomPayment",
      deposit: true,
      amount,
      payment_type_id: input.payment_type_id,
      ...(input.reference ? { custom: { portico_transaction_id: input.reference } } : {}),
    },
    {
      type: "Payments::CustomPayment",
      deposit: true,
      amount,
      payment_type_id: input.payment_type_id,
    },
    {
      deposit: true,
      amount,
      payment_type_id: input.payment_type_id,
    },
    {
      type: "ExternalPayment",
      deposit: true,
      amount,
      ...(input.reference ? { reference: input.reference } : {}),
    },
    {
      type: "CashPayment",
      deposit: true,
      amount,
    },
  ];

  let lastError: unknown;
  for (const payload of attempts) {
    try {
      const { res } = await retailFetch(`/sales/orders/${orderId}/payments`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return parseLocationId(res.headers.get("location"));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Retail payment create failed.");
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts[0] || "Customer",
    last_name: parts.slice(1).join(" ") || "Web",
  };
}

async function attachSalesOrderAddresses(
  orderId: number,
  customerId: number,
  addressId: number,
  shipping: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    fullName: string;
  }
): Promise<void> {
  const names = splitName(shipping.fullName);
  const addressBody = {
    first_name: names.first_name,
    last_name: names.last_name,
    line_1: shipping.line1,
    line_2: shipping.line2 || null,
    city: shipping.city,
    state: shipping.state,
    postal_code: shipping.postal_code,
    country: retailCountry(shipping.country),
  };

  try {
    await retailFetch(`/customers/${customerId}`, {
      method: "PUT",
      body: JSON.stringify({
        address_id: addressId,
        shipping_address_id: addressId,
        billing_address_id: addressId,
      }),
    });
  } catch (err) {
    console.warn("Heartland Retail customer address defaults skipped:", err);
  }

  try {
    await retailFetch(`/sales/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({
        shipping_address_id: addressId,
        billing_address_id: addressId,
        shipping_address: addressBody,
        billing_address: addressBody,
      }),
    });
  } catch {
    await retailFetch(`/sales/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({
        shipping_address_id: addressId,
        billing_address_id: addressId,
      }),
    });
  }
}

async function getSalesOrderBalance(orderId: number): Promise<number | null> {
  try {
    const { body } = await retailFetch(`/sales/orders/${orderId}?_include[]=payments`);
    const record = body as Record<string, unknown>;
    for (const key of ["balance", "amount_due", "due", "total"]) {
      const raw = record[key];
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch (err) {
    console.warn("Heartland Retail order balance lookup skipped:", err);
  }
  return null;
}

export async function openSalesOrder(orderId: number): Promise<void> {
  await retailFetch(`/sales/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "open" }),
  });
}

export async function createInvoice(input: {
  order_id: number;
  station_id: number;
  source_location_id: number;
}): Promise<number> {
  const { res } = await retailFetch("/sales/invoices", {
    method: "POST",
    body: JSON.stringify({
      type: "Invoice",
      order_id: input.order_id,
      station_id: input.station_id,
      source_location_id: input.source_location_id,
    }),
  });
  return parseLocationId(res.headers.get("location"));
}

export async function completeInvoice(invoiceId: number): Promise<void> {
  await retailFetch(`/sales/invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "complete" }),
  });
}

export async function voidSalesOrder(orderId: number): Promise<void> {
  let lastError: unknown;
  for (const status of ["void", "cancelled", "canceled"]) {
    try {
      await retailFetch(`/sales/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not void sales order ${orderId}.`);
}

export async function voidInvoice(invoiceId: number): Promise<void> {
  await retailFetch(`/sales/invoices/${invoiceId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "void" }),
  });
}

async function voidInvoicesForOrder(salesOrderId: number): Promise<number | null> {
  let firstInvoiceId: number | null = null;
  try {
    const filter = encodeURIComponent(JSON.stringify({ order_id: salesOrderId }));
    const { body } = await retailFetch(`/sales/invoices?_filter[]=${filter}&per_page=20`);
    const result = body as SearchResult<{ id: number; status?: string }>;
    for (const invoice of result.results ?? []) {
      firstInvoiceId = firstInvoiceId ?? invoice.id;
      try {
        await voidInvoice(invoice.id);
      } catch (err) {
        console.warn(`Heartland Retail invoice ${invoice.id} void skipped:`, err);
      }
    }
  } catch (err) {
    console.warn("Heartland Retail invoice lookup for void skipped:", err);
  }
  return firstInvoiceId;
}

/** Cancel an unfulfilled sales order (releases committed qty). This is not a return. */
export async function reverseRetailSale(salesOrderId: number): Promise<void> {
  await voidInvoicesForOrder(salesOrderId);
  try {
    await voidSalesOrder(salesOrderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!/void|already|status/i.test(message)) throw err;
    console.warn("Heartland Retail sales order void skipped:", err);
  }
}

async function listCustomerSalesOrders(customerId: number): Promise<{ id: number; status?: string }[]> {
  const filter = encodeURIComponent(JSON.stringify({ customer_id: customerId }));
  const { body } = await retailFetch(`/sales/orders?_filter[]=${filter}&per_page=50`);
  const result = body as SearchResult<{ id: number; status?: string }>;
  return result.results ?? [];
}

async function salesOrderHasItems(orderId: number, itemIds: Set<number>): Promise<boolean> {
  try {
    const { body } = await retailFetch(`/sales/orders/${orderId}/lines?per_page=50`);
    const result = body as SearchResult<{ item_id?: number }>;
    return (result.results ?? []).some((line) => typeof line.item_id === "number" && itemIds.has(line.item_id));
  } catch {
    return false;
  }
}

/**
 * Heartland Return ticket: negative qty + complete, which restocks on-hand.
 * Completing a return is different from voiding a pending sales order.
 */
export async function createRetailReturn(input: {
  customerId: number;
  lines: RetailCheckoutLine[];
  parentInvoiceId?: number;
}): Promise<number> {
  const stationId = Number(process.env.HEARTLAND_RETAIL_STATION_ID);
  const locationId = Number(process.env.HEARTLAND_RETAIL_LOCATION_ID);

  const createAttempts: Record<string, unknown>[] = [
    {
      type: "Return",
      station_id: stationId,
      source_location_id: locationId,
      customer_id: input.customerId,
      affect_inventory: true,
      ...(input.parentInvoiceId ? { parent_transaction_id: input.parentInvoiceId } : {}),
    },
    {
      type: "Return",
      station_id: stationId,
      source_location_id: locationId,
      customer_id: input.customerId,
      affect_inventory: true,
    },
    {
      type: "Ticket",
      station_id: stationId,
      source_location_id: locationId,
      customer_id: input.customerId,
    },
  ];

  let ticketId: number | null = null;
  let lastError: unknown;
  for (const payload of createAttempts) {
    try {
      const { res } = await retailFetch("/sales/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      ticketId = parseLocationId(res.headers.get("location"));
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (ticketId == null) {
    throw lastError instanceof Error ? lastError : new Error("Could not create Heartland return ticket.");
  }

  for (const line of input.lines) {
    const lineBody = {
      type: "ItemLine",
      item_id: line.heartlandItemId,
      qty: -Math.abs(line.quantity),
      adjusted_unit_price: line.unitPrice,
    };
    try {
      await retailFetch(`/sales/tickets/${ticketId}/item_lines`, {
        method: "POST",
        body: JSON.stringify(lineBody),
      });
    } catch {
      await retailFetch(`/sales/tickets/${ticketId}/lines`, {
        method: "POST",
        body: JSON.stringify(lineBody),
      });
    }
  }

  try {
    const { body } = await retailFetch(`/sales/tickets/${ticketId}`);
    const ticket = body as { balance?: number; total?: number };
    const due = typeof ticket.balance === "number" ? ticket.balance : ticket.total;
    if (typeof due === "number" && due !== 0) {
      await retailFetch(`/sales/tickets/${ticketId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          type: "CashPayment",
          amount: due,
        }),
      });
    }
  } catch (err) {
    console.warn("Heartland Retail return payment skipped:", err);
  }

  await retailFetch(`/sales/tickets/${ticketId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "complete" }),
  });

  return ticketId;
}

async function snapshotsForLines(
  lines: RetailCheckoutLine[]
): Promise<Map<number, HeartlandItemQty>> {
  const map = new Map<number, HeartlandItemQty>();
  await Promise.all(
    [...new Set(lines.map((line) => line.heartlandItemId))].map(async (id) => {
      map.set(id, await getItemInventorySnapshot(id));
    })
  );
  return map;
}

async function findInventoryAdjustmentReasonId(): Promise<number> {
  const configured = Number(process.env.HEARTLAND_RETAIL_ADJUSTMENT_REASON_ID);
  if (Number.isFinite(configured) && configured > 0) return configured;

  for (const path of [
    "/reason_codes/inventory_adjustment_reasons?active=true&per_page=50",
    "/reason_codes/inventory_adjustment_reasons?per_page=50",
  ]) {
    try {
      const { body } = await retailFetch(path);
      const results =
        (body as SearchResult<{ id: number; name?: string; description?: string }>).results ?? [];
      const preferred = results.find((reason) =>
        /return|refund|correct|count|found|overage|website/i.test(
          `${reason.name ?? ""} ${reason.description ?? ""}`
        )
      );
      if (preferred?.id) return preferred.id;
      if (results[0]?.id) return results[0].id;
    } catch (err) {
      console.warn("Heartland Retail adjustment reason lookup skipped:", err);
    }
  }
  throw new Error("No Heartland inventory adjustment reason is available.");
}

async function completeInventoryAdjustment(lines: RetailCheckoutLine[]): Promise<number> {
  const locationId = Number(process.env.HEARTLAND_RETAIL_LOCATION_ID);
  const reasonId = await findInventoryAdjustmentReasonId();
  const { res } = await retailFetch("/inventory/adjustment_sets", {
    method: "POST",
    body: JSON.stringify({
      adjustment_reason_id: reasonId,
      location_id: locationId,
    }),
  });
  const setId = parseLocationId(res.headers.get("location"));

  for (const line of lines) {
    let unitCost = 0;
    try {
      const item = await getItem(line.heartlandItemId);
      unitCost = Number(item.cost) || 0;
    } catch {
      unitCost = 0;
    }
    await retailFetch(`/inventory/adjustment_sets/${setId}/lines`, {
      method: "POST",
      body: JSON.stringify({
        item_id: line.heartlandItemId,
        qty: Math.abs(line.quantity),
        unit_cost: unitCost,
      }),
    });
  }

  await retailFetch(`/inventory/adjustment_sets/${setId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "complete" }),
  });
  return setId;
}

/**
 * Refund path: void leftover sales orders (releases committed qty).
 * Add on-hand only when the unit was actually sold — never while qty is
 * still committed, and never a second time for the same shortfall.
 */
export async function restockRetailInventory(input: {
  email: string;
  fullName: string;
  lines: RetailCheckoutLine[];
  existingSalesOrderId?: number | null;
  /** False on already-refunded orders so Put stock back cannot add on-hand again. */
  allowOnHandIncrease?: boolean;
}): Promise<{
  returnTicketId: number | null;
  voidedOrderIds: number[];
  adjustmentSetId: number | null;
}> {
  const itemIds = new Set(input.lines.map((line) => line.heartlandItemId));
  const voidedOrderIds: number[] = [];
  const before = await snapshotsForLines(input.lines);
  const customerId = await upsertCustomerByEmail({
    email: input.email,
    fullName: input.fullName,
  });

  const candidateIds = new Set<number>();
  if (input.existingSalesOrderId) candidateIds.add(input.existingSalesOrderId);

  try {
    const orders = await listCustomerSalesOrders(customerId);
    for (const order of orders) {
      const status = (order.status ?? "").toLowerCase();
      if (status === "void" || status === "cancelled" || status === "canceled") continue;
      if (candidateIds.has(order.id) || (await salesOrderHasItems(order.id, itemIds))) {
        candidateIds.add(order.id);
      }
    }
  } catch (err) {
    console.warn("Heartland Retail customer order search skipped:", err);
  }

  let parentInvoiceId: number | undefined;
  for (const orderId of candidateIds) {
    try {
      const invoiceId = await voidInvoicesForOrder(orderId);
      if (invoiceId) parentInvoiceId = parentInvoiceId ?? invoiceId;
      await voidSalesOrder(orderId);
      voidedOrderIds.push(orderId);
    } catch (err) {
      console.warn(`Heartland Retail sales order ${orderId} void skipped:`, err);
    }
  }

  const allowOnHandIncrease = input.allowOnHandIncrease !== false;
  const afterVoid = await snapshotsForLines(input.lines);
  const soldShortfall = allowOnHandIncrease
    ? input.lines.filter((line) => {
        const start = before.get(line.heartlandItemId);
        const now = afterVoid.get(line.heartlandItemId);
        if (!start || !now) return false;
        if (now.committed > 0) return false;
        if (now.available > start.available) return false;
        if (now.onHand > start.onHand) return false;
        return now.available === start.available && now.onHand === start.onHand;
      })
    : [];

  let returnTicketId: number | null = null;
  let adjustmentSetId: number | null = null;
  if (soldShortfall.length > 0) {
    try {
      returnTicketId = await createRetailReturn({
        customerId,
        lines: soldShortfall,
        parentInvoiceId,
      });
    } catch (err) {
      console.error("Heartland Retail return ticket failed:", err);
    }

    const afterReturn = await snapshotsForLines(soldShortfall);
    const stillSold = soldShortfall.filter((line) => {
      const start = before.get(line.heartlandItemId);
      const now = afterReturn.get(line.heartlandItemId);
      return Boolean(start && now && now.committed === 0 && now.onHand < start.onHand);
    });
    if (stillSold.length > 0) {
      adjustmentSetId = await completeInventoryAdjustment(
        stillSold.map((line) => {
          const start = before.get(line.heartlandItemId);
          const now = afterReturn.get(line.heartlandItemId);
          const missing = Math.max(0, (start?.onHand ?? 0) - (now?.onHand ?? 0));
          return { ...line, quantity: missing || line.quantity };
        })
      );
    }
  }

  return { returnTicketId, voidedOrderIds, adjustmentSetId };
}

export interface RetailCheckoutLine {
  heartlandItemId: number;
  quantity: number;
  unitPrice: number;
}

/**
 * After Portico charge: create Retail sales order, custom payment, open + invoice
 * so inventory is deducted in Heartland Retail (source of truth).
 */
export function salesOrderIdFromRetailError(message: string | null | undefined): number | null {
  const match = message?.match(/\/sales\/orders\/(\d+)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function syncPaidOrderToRetail(input: {
  email: string;
  fullName: string;
  shipping: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    fullName?: string;
  };
  lines: RetailCheckoutLine[];
  shippingCharge: number;
  totalAmount: number;
  porticoTransactionId?: string;
  /** Resume an order that already has lines (payment previously 500'd). */
  existingSalesOrderId?: number;
  /** Persist the Retail id as soon as it exists so retries do not create duplicates. */
  persistSalesOrderId?: (id: number) => Promise<void>;
}): Promise<{ salesOrderId: number; invoiceId: number }> {
  if (!heartlandRetailConfigured()) {
    throw new Error("Heartland Retail is not fully configured.");
  }

  const stationId = Number(process.env.HEARTLAND_RETAIL_STATION_ID);
  const locationId = Number(process.env.HEARTLAND_RETAIL_LOCATION_ID);
  const paymentTypeId = Number(process.env.HEARTLAND_RETAIL_WEB_PAYMENT_TYPE);

  const customerId = await upsertCustomerByEmail({
    email: input.email,
    fullName: input.fullName,
  });

  const names = splitName(input.fullName);
  const addressId = await createCustomerAddress(customerId, {
    first_name: names.first_name,
    last_name: names.last_name,
    address_1: input.shipping.line1,
    address_2: input.shipping.line2,
    city: input.shipping.city,
    state: input.shipping.state,
    zip: input.shipping.postal_code,
    country: input.shipping.country,
  });

  let salesOrderId = input.existingSalesOrderId;
  if (!salesOrderId) {
    salesOrderId = await createSalesOrder({
      customer_id: customerId,
      station_id: stationId,
      source_location_id: locationId,
      shipping_charge: Math.round((input.shippingCharge || 0) * 100) / 100,
      shipping_address_id: addressId,
      billing_address_id: addressId,
    });
    await input.persistSalesOrderId?.(salesOrderId);

    for (const line of input.lines) {
      const lineId = await addOrderLine(salesOrderId, {
        item_id: line.heartlandItemId,
        qty: line.quantity,
        adjusted_unit_price: line.unitPrice,
      });
      await distributeOrderLine(salesOrderId, lineId, locationId);
    }
  } else {
    await input.persistSalesOrderId?.(salesOrderId);
  }

  await attachSalesOrderAddresses(salesOrderId, customerId, addressId, {
    ...input.shipping,
    fullName: input.fullName,
  });

  const due = (await getSalesOrderBalance(salesOrderId)) ?? input.totalAmount;
  try {
    await addOrderPayment(salesOrderId, {
      amount: due > 0 ? due : input.totalAmount,
      payment_type_id: paymentTypeId,
      reference: input.porticoTransactionId,
    });
  } catch (err) {
    console.warn("Heartland Retail payment step skipped:", err);
  }

  try {
    await openSalesOrder(salesOrderId);
  } catch (openErr) {
    try {
      const invoiceId = await createInvoice({
        order_id: salesOrderId,
        station_id: stationId,
        source_location_id: locationId,
      });
      try {
        await completeInvoice(invoiceId);
      } catch (err) {
        console.warn("Heartland Retail invoice complete step:", err);
      }
      return { salesOrderId, invoiceId };
    } catch {
      throw openErr;
    }
  }

  const invoiceId = await createInvoice({
    order_id: salesOrderId,
    station_id: stationId,
    source_location_id: locationId,
  });

  try {
    await completeInvoice(invoiceId);
  } catch (err) {
    // Some accounts auto-complete on create; log and continue.
    console.warn("Heartland Retail invoice complete step:", err);
  }

  return { salesOrderId, invoiceId };
}
