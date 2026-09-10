import "server-only";
import { STORE_CONTACT } from "@/lib/constants";
import { FEDEX_CHECKOUT_SERVICES } from "@/lib/shipping-services";
import type { ShippingAddress } from "@/lib/types";

export { isFedExServiceCode } from "@/lib/shipping-services";

export function fedexConfigured(): boolean {
  return Boolean(
    process.env.FEDEX_API_KEY?.trim() &&
      process.env.FEDEX_SECRET_KEY?.trim() &&
      process.env.FEDEX_ACCOUNT_NUMBER?.trim()
  );
}

function fedexBaseUrl(): string {
  const env = process.env.FEDEX_ENV?.trim().toLowerCase();
  return env === "sandbox" || env === "test" ? "https://apis-sandbox.fedex.com" : "https://apis.fedex.com";
}

function accountNumber(): string {
  return process.env.FEDEX_ACCOUNT_NUMBER!.replace(/\s+/g, "");
}

function pickupType(): string {
  return process.env.FEDEX_PICKUP_TYPE?.trim() || "DROPOFF_AT_FEDEX_LOCATION";
}

function normalizeState(state: string): string {
  const raw = state.trim();
  if (raw.length === 2) return raw.toUpperCase();
  if (/^georgia$/i.test(raw)) return "GA";
  return raw.slice(0, 2).toUpperCase();
}

function normalizePostal(zip: string): string {
  return zip.replace(/\D/g, "").slice(0, 5);
}

function countryCode(country: string): string {
  return country === "United States" || /^usa?$/i.test(country) ? "US" : country.slice(0, 2).toUpperCase();
}

function phoneDigits(value?: string | null): string {
  return (value || STORE_CONTACT.phoneDisplay).replace(/\D/g, "").slice(-10);
}

function fedexAddress(shipping: ShippingAddress) {
  return {
    streetLines: [shipping.line1, shipping.line2].filter(Boolean) as string[],
    city: shipping.city,
    stateOrProvinceCode: normalizeState(shipping.state),
    postalCode: normalizePostal(shipping.postal_code),
    countryCode: countryCode(shipping.country),
    residential: true,
  };
}

function shipperAddress() {
  return {
    streetLines: ["415 Peachtree Parkway", "Ste 235"],
    city: "Cumming",
    stateOrProvinceCode: "GA",
    postalCode: "30041",
    countryCode: "US",
    residential: false,
  };
}

function packageLine() {
  return {
    weight: { units: "LB", value: 1 },
    dimensions: { length: 12, width: 10, height: 3, units: "IN" },
  };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function fedexAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const id = process.env.FEDEX_API_KEY?.trim();
  const secret = process.env.FEDEX_SECRET_KEY?.trim();
  if (!id || !secret || !process.env.FEDEX_ACCOUNT_NUMBER?.trim()) {
    throw new Error(
      "Add FEDEX_API_KEY, FEDEX_SECRET_KEY, and FEDEX_ACCOUNT_NUMBER in Vercel. Create a project at developer.fedex.com with Rates and Ship APIs."
    );
  }

  const res = await fetch(`${fedexBaseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errors?: { message?: string }[];
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      body.errors?.[0]?.message || body.error_description || "FedEx login failed. Check the API key, secret, and FEDEX_ENV."
    );
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in) || 3600) * 1000,
  };
  return body.access_token;
}

function fedexHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-locale": "en_US",
  };
}

export function fedexServiceName(code: string): string {
  switch (code) {
    case "FEDEX_GROUND":
      return "FedEx Ground";
    case "GROUND_HOME_DELIVERY":
      return "FedEx Home Delivery";
    case "FEDEX_EXPRESS_SAVER":
      return "FedEx Express Saver";
    case "FEDEX_2_DAY":
      return "FedEx 2Day";
    case "FEDEX_2_DAY_AM":
      return "FedEx 2Day A.M.";
    case "STANDARD_OVERNIGHT":
      return "FedEx Standard Overnight";
    case "PRIORITY_OVERNIGHT":
      return "FedEx Priority Overnight";
    case "FIRST_OVERNIGHT":
      return "FedEx First Overnight";
    default:
      return code.replace(/_/g, " ").replace(/\bFedex\b/gi, "FedEx");
  }
}

function accountRateAmount(details: {
  rateType?: string;
  totalNetCharge?: number | string;
  totalNetFedExCharge?: number | string;
}[]): number | null {
  const preferred =
    details.find((row) => /account/i.test(row.rateType ?? "")) ?? details[0];
  if (!preferred) return null;
  const raw = preferred.totalNetCharge ?? preferred.totalNetFedExCharge;
  const amount = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

export async function quoteFedExRates(shipping: ShippingAddress): Promise<
  { code: string; name: string; amount: number }[]
> {
  const token = await fedexAccessToken();
  const res = await fetch(`${fedexBaseUrl()}/rate/v1/rates/quotes`, {
    method: "POST",
    headers: fedexHeaders(token),
    body: JSON.stringify({
      accountNumber: { value: accountNumber() },
      requestedShipment: {
        shipper: { address: shipperAddress() },
        recipient: { address: fedexAddress(shipping) },
        pickupType: pickupType(),
        rateRequestType: ["ACCOUNT", "LIST"],
        packagingType: "YOUR_PACKAGING",
        requestedPackageLineItems: [packageLine()],
      },
    }),
  });
  const body = (await res.json()) as {
    output?: {
      rateReplyDetails?: {
        serviceType?: string;
        serviceName?: string;
        ratedShipmentDetails?: {
          rateType?: string;
          totalNetCharge?: number | string;
          totalNetFedExCharge?: number | string;
        }[];
      }[];
    };
    errors?: { message?: string }[];
  };
  const rows = body.output?.rateReplyDetails ?? [];
  if (!res.ok || rows.length === 0) {
    throw new Error(body.errors?.[0]?.message || "FedEx could not quote this address.");
  }

  const quoted = rows
    .map((row) => {
      const code = (row.serviceType ?? "").trim().toUpperCase();
      const amount = accountRateAmount(row.ratedShipmentDetails ?? []);
      return {
        code,
        name: row.serviceName?.trim() || fedexServiceName(code),
        amount: amount ?? NaN,
      };
    })
    .filter((row) => row.code && Number.isFinite(row.amount) && row.amount >= 0);
  const preferred = quoted.filter((row) => FEDEX_CHECKOUT_SERVICES.has(row.code));
  return (preferred.length > 0 ? preferred : quoted).sort((a, b) => a.amount - b.amount);
}

function shipDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function buyFedExShippingLabel(
  shipping: ShippingAddress,
  serviceType: string
): Promise<{ trackingNumber: string; carrier: string; labelUrl: string }> {
  const token = await fedexAccessToken();
  const account = accountNumber();
  const name = (shipping.full_name.trim() || "Customer").slice(0, 35);

  const res = await fetch(`${fedexBaseUrl()}/ship/v1/shipments`, {
    method: "POST",
    headers: fedexHeaders(token),
    body: JSON.stringify({
      labelResponseOptions: "LABEL",
      requestedShipment: {
        shipDatestamp: shipDate(),
        pickupType: pickupType(),
        serviceType,
        packagingType: "YOUR_PACKAGING",
        shipper: {
          contact: {
            personName: "Sandryne Boutique",
            phoneNumber: phoneDigits(),
            companyName: "Sandryne Boutique",
          },
          address: shipperAddress(),
        },
        recipients: [
          {
            contact: {
              personName: name,
              phoneNumber: phoneDigits(shipping.phone),
            },
            address: fedexAddress(shipping),
          },
        ],
        shippingChargesPayment: {
          paymentType: "SENDER",
          payor: {
            responsibleParty: {
              accountNumber: { value: account },
            },
          },
        },
        labelSpecification: {
          imageType: "PDF",
          labelStockType: "PAPER_4X6",
        },
        requestedPackageLineItems: [packageLine()],
      },
      accountNumber: { value: account },
    }),
  });

  const body = (await res.json()) as {
    output?: {
      transactionShipments?: {
        masterTrackingNumber?: string;
        pieceResponses?: {
          trackingNumber?: string;
          packageDocuments?: { encodedLabel?: string; contentType?: string }[];
        }[];
      }[];
    };
    errors?: { message?: string }[];
  };

  const shipment = body.output?.transactionShipments?.[0];
  const piece = shipment?.pieceResponses?.[0];
  const label = piece?.packageDocuments?.find((doc) => doc.encodedLabel)?.encodedLabel;
  const tracking = piece?.trackingNumber || shipment?.masterTrackingNumber;

  if (!res.ok || !label || !tracking) {
    throw new Error(body.errors?.[0]?.message || "FedEx could not create this label.");
  }

  return {
    trackingNumber: tracking,
    carrier: fedexServiceName(serviceType),
    labelUrl: `data:application/pdf;base64,${label}`,
  };
}
