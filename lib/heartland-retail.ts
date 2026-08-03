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

function inventoryRowQty(row: HeartlandInventoryValue): number {
  const raw = row.qty_available ?? row.qty_on_hand ?? row.qty ?? 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}

/** Qty available for one item (all locations summed, or filtered to web location). */
export async function getItemQtyAvailable(itemId: number): Promise<number> {
  const locationId = Number(process.env.HEARTLAND_RETAIL_LOCATION_ID || 0);
  const params = new URLSearchParams();
  params.append("group[]", "item_id");
  if (locationId > 0) params.append("group[]", "location_id");
  params.set("per_page", "100");
  params.append("_filter[]", JSON.stringify({ item_id: itemId }));

  const { body } = await retailFetch(`/inventory/values?${params.toString()}`);
  const result = body as SearchResult<HeartlandInventoryValue>;
  const rows = result.results ?? [];

  if (locationId > 0) {
    const atLocation = rows.filter((r) => r.location_id === locationId);
    if (atLocation.length > 0) {
      return atLocation.reduce((s, r) => s + inventoryRowQty(r), 0);
    }
  }

  return rows.reduce((s, r) => s + inventoryRowQty(r), 0);
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
  const filter = encodeURIComponent(JSON.stringify({ email: email.toLowerCase() }));
  const { body } = await retailFetch(`/customers?_filter[]=${filter}&per_page=5`);
  const result = body as SearchResult<HeartlandCustomer>;
  const hits = result.results ?? [];
  return hits[0] ?? null;
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

export async function createCustomerAddress(
  customerId: number,
  address: {
    address_1: string;
    address_2?: string | null;
    city: string;
    state: string;
    zip: string;
    country: string;
  }
): Promise<number> {
  const { res } = await retailFetch(`/customers/${customerId}/addresses`, {
    method: "POST",
    body: JSON.stringify({
      address_1: address.address_1,
      address_2: address.address_2 || null,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country,
    }),
  });
  return parseLocationId(res.headers.get("location"));
}

export async function createSalesOrder(input: {
  customer_id: number;
  station_id: number;
  source_location_id: number;
  shipping_charge?: number;
}): Promise<number> {
  const { res } = await retailFetch("/sales/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseLocationId(res.headers.get("location"));
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
  const payload: Record<string, unknown> = {
    type: "CustomPayment",
    deposit: true,
    amount: input.amount,
    payment_type_id: input.payment_type_id,
  };
  if (input.reference) {
    payload.custom = { portico_transaction_id: input.reference };
  }
  const { res } = await retailFetch(`/sales/orders/${orderId}/payments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseLocationId(res.headers.get("location"));
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

export interface RetailCheckoutLine {
  heartlandItemId: number;
  quantity: number;
  unitPrice: number;
}

/**
 * After Portico charge: create Retail sales order, custom payment, open + invoice
 * so inventory is deducted in Heartland Retail (source of truth).
 */
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
  };
  lines: RetailCheckoutLine[];
  shippingCharge: number;
  totalAmount: number;
  porticoTransactionId?: string;
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

  try {
    await createCustomerAddress(customerId, {
      address_1: input.shipping.line1,
      address_2: input.shipping.line2,
      city: input.shipping.city,
      state: input.shipping.state,
      zip: input.shipping.postal_code,
      country: input.shipping.country,
    });
  } catch (err) {
    // Address shape varies by account; order can still proceed.
    console.warn("Heartland Retail customer address create skipped:", err);
  }

  const salesOrderId = await createSalesOrder({
    customer_id: customerId,
    station_id: stationId,
    source_location_id: locationId,
    shipping_charge: input.shippingCharge,
  });

  for (const line of input.lines) {
    const lineId = await addOrderLine(salesOrderId, {
      item_id: line.heartlandItemId,
      qty: line.quantity,
      adjusted_unit_price: line.unitPrice,
    });
    await distributeOrderLine(salesOrderId, lineId, locationId);
  }

  await addOrderPayment(salesOrderId, {
    amount: input.totalAmount,
    payment_type_id: paymentTypeId,
    reference: input.porticoTransactionId,
  });

  await openSalesOrder(salesOrderId);

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
