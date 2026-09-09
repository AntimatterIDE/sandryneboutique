import "server-only";
import { STORE_CONTACT } from "@/lib/constants";
import type { ShippingAddress } from "@/lib/types";

export interface UpsRate {
  code: string;
  name: string;
  amount: string;
}

export interface PurchasedLabel {
  trackingNumber: string;
  carrier: string;
  labelUrl: string;
  amount?: string;
}

function upsConfigured(): boolean {
  return Boolean(
    process.env.UPS_CLIENT_ID?.trim() &&
      process.env.UPS_CLIENT_SECRET?.trim() &&
      process.env.UPS_ACCOUNT_NUMBER?.trim()
  );
}

export function shippingLabelsConfigured(): boolean {
  return upsConfigured();
}

function upsBaseUrl(): string {
  const env = process.env.UPS_ENV?.trim().toLowerCase();
  return env === "test" || env === "cie"
    ? "https://wwwcie.ups.com"
    : "https://onlinetools.ups.com";
}

function accountNumber(): string {
  return process.env.UPS_ACCOUNT_NUMBER!.replace(/\s+/g, "");
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

function shipperAddress() {
  return {
    AddressLine: ["415 Peachtree Parkway", "Ste 235"],
    City: "Cumming",
    StateProvinceCode: "GA",
    PostalCode: "30041",
    CountryCode: "US",
  };
}

function shipToAddress(shipping: ShippingAddress) {
  const lines = [shipping.line1, shipping.line2].filter(Boolean) as string[];
  const name = (shipping.full_name.trim() || "Customer").slice(0, 35);
  return {
    Name: name,
    AttentionName: name,
    Phone: { Number: (shipping.phone || STORE_CONTACT.phoneDisplay).replace(/\D/g, "").slice(-10) },
    Address: {
      AddressLine: lines.slice(0, 2),
      City: shipping.city,
      StateProvinceCode: normalizeState(shipping.state),
      PostalCode: normalizePostal(shipping.postal_code),
      CountryCode: shipping.country === "United States" ? "US" : shipping.country.slice(0, 2).toUpperCase(),
    },
  };
}

function packagePayload() {
  return {
    PackagingType: { Code: "02", Description: "Customer Supplied" },
    Dimensions: {
      UnitOfMeasurement: { Code: "IN", Description: "Inches" },
      Length: "12",
      Width: "10",
      Height: "3",
    },
    PackageWeight: {
      UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
      Weight: "1",
    },
  };
}

async function upsAccessToken(): Promise<string> {
  const id = process.env.UPS_CLIENT_ID?.trim();
  const secret = process.env.UPS_CLIENT_SECRET?.trim();
  if (!id || !secret || !process.env.UPS_ACCOUNT_NUMBER?.trim()) {
    throw new Error(
      "Add UPS_CLIENT_ID, UPS_CLIENT_SECRET, and UPS_ACCOUNT_NUMBER in Vercel. Create an app at developer.ups.com and add the Rating + Shipping products."
    );
  }

  const res = await fetch(`${upsBaseUrl()}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || "UPS login failed. Check the Client ID/Secret and UPS_ENV.");
  }
  return body.access_token;
}

function upsHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    transId: `sb-${Date.now()}`,
    transactionSrc: "SandryneBoutique",
  };
}

function rateAmount(row: {
  TotalCharges?: { MonetaryValue?: string };
  NegotiatedRateCharges?: { TotalCharge?: { MonetaryValue?: string } };
}): string {
  return (
    row.NegotiatedRateCharges?.TotalCharge?.MonetaryValue ||
    row.TotalCharges?.MonetaryValue ||
    "0.00"
  );
}

export async function quoteUpsRates(shipping: ShippingAddress): Promise<UpsRate[]> {
  const token = await upsAccessToken();
  const shipper = accountNumber();
  const origin = shipperAddress();
  const res = await fetch(`${upsBaseUrl()}/api/rating/v2409/Shop`, {
    method: "POST",
    headers: upsHeaders(token),
    body: JSON.stringify({
      RateRequest: {
        Request: { RequestOption: "Shop" },
        PickupType: { Code: "01" },
        CustomerClassification: { Code: "00" },
        Shipment: {
          Shipper: {
            Name: "Sandryne Boutique",
            ShipperNumber: shipper,
            Address: origin,
          },
          ShipTo: shipToAddress(shipping),
          ShipFrom: {
            Name: "Sandryne Boutique",
            Address: origin,
          },
          PaymentDetails: {
            ShipmentCharge: {
              Type: "01",
              BillShipper: { AccountNumber: shipper },
            },
          },
          ShipmentRatingOptions: {
            NegotiatedRatesIndicator: "Y",
          },
          Package: packagePayload(),
        },
      },
    }),
  });

  const body = (await res.json()) as {
    RateResponse?: {
      RatedShipment?: {
        Service?: { Code?: string; Description?: string };
        TotalCharges?: { MonetaryValue?: string };
        NegotiatedRateCharges?: { TotalCharge?: { MonetaryValue?: string } };
      }[];
    };
    response?: { errors?: { message?: string }[] };
  };

  const rows = body.RateResponse?.RatedShipment;
  if (!res.ok || !rows?.length) {
    throw new Error(body.response?.errors?.[0]?.message || "UPS could not quote this address.");
  }

  return rows
    .map((row) => ({
      code: row.Service?.Code || "",
      name: row.Service?.Description || serviceName(row.Service?.Code || ""),
      amount: rateAmount(row),
    }))
    .filter((row) => row.code)
    .sort((a, b) => Number(a.amount) - Number(b.amount));
}

/** Standard checkout rate: UPS Ground, or the cheapest quoted service if Ground is unavailable. */
export async function quoteCheckoutGroundRate(shipping: ShippingAddress): Promise<{
  amount: number;
  code: string;
  name: string;
}> {
  const rates = await quoteUpsRates(shipping);
  const ground = rates.find((row) => row.code === "03") ?? rates[0];
  if (!ground) throw new Error("UPS could not quote this address.");
  const amount = Math.round(Number(ground.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("UPS returned an invalid shipping rate.");
  }
  return {
    amount,
    code: ground.code,
    name: ground.name.startsWith("UPS") ? ground.name : `UPS ${ground.name}`,
  };
}

export async function buyUpsShippingLabel(
  shipping: ShippingAddress,
  serviceCode = "03"
): Promise<PurchasedLabel> {
  const token = await upsAccessToken();
  const shipper = accountNumber();
  const dest = shipToAddress(shipping);

  const res = await fetch(`${upsBaseUrl()}/api/shipments/v2409/ship`, {
    method: "POST",
    headers: upsHeaders(token),
    body: JSON.stringify({
      ShipmentRequest: {
        Request: { RequestOption: "nonvalidate", SubVersion: "1801" },
        Shipment: {
          Description: "Sandryne Boutique",
          Shipper: {
            Name: "Sandryne Boutique",
            AttentionName: "Sandryne Boutique",
            Phone: { Number: STORE_CONTACT.phoneDisplay.replace(/\D/g, "").slice(-10) },
            ShipperNumber: shipper,
            Address: shipperAddress(),
          },
          ShipTo: dest,
          ShipFrom: {
            Name: "Sandryne Boutique",
            AttentionName: "Sandryne Boutique",
            Phone: { Number: STORE_CONTACT.phoneDisplay.replace(/\D/g, "").slice(-10) },
            Address: shipperAddress(),
          },
          PaymentInformation: {
            ShipmentCharge: {
              Type: "01",
              BillShipper: { AccountNumber: shipper },
            },
          },
          Service: { Code: serviceCode, Description: serviceName(serviceCode) },
          Package: {
            Description: "Apparel",
            Packaging: { Code: "02", Description: "Customer Supplied" },
            Dimensions: packagePayload().Dimensions,
            PackageWeight: packagePayload().PackageWeight,
          },
        },
        LabelSpecification: {
          LabelImageFormat: { Code: "GIF", Description: "GIF" },
          LabelStockSize: { Height: "6", Width: "4" },
        },
      },
    }),
  });

  const body = (await res.json()) as {
    ShipmentResponse?: {
      ShipmentResults?: {
        ShipmentIdentificationNumber?: string;
        ShipmentCharges?: { TotalCharges?: { MonetaryValue?: string } };
        PackageResults?: {
          TrackingNumber?: string;
          ShippingLabel?: { GraphicImage?: string; ImageFormat?: { Code?: string } };
        };
      };
    };
    response?: { errors?: { message?: string }[] };
  };

  const results = body.ShipmentResponse?.ShipmentResults;
  const pkg = results?.PackageResults;
  const graphic = pkg?.ShippingLabel?.GraphicImage;
  const tracking = pkg?.TrackingNumber || results?.ShipmentIdentificationNumber;

  if (!res.ok || !graphic || !tracking) {
    throw new Error(body.response?.errors?.[0]?.message || "UPS could not create this label.");
  }

  return {
    trackingNumber: tracking,
    carrier: `UPS ${serviceName(serviceCode)}`,
    labelUrl: `data:image/gif;base64,${graphic}`,
    amount: results?.ShipmentCharges?.TotalCharges?.MonetaryValue,
  };
}

const CHECKOUT_SERVICE_CODES = new Set(["01", "02", "03", "12", "13", "14", "59"]);

export function isFreeEligibleUpsService(code: string): boolean {
  return code === "03" || code === "flat";
}

function serviceName(code: string): string {
  switch (code) {
    case "01":
      return "Next Day Air";
    case "02":
      return "2nd Day Air";
    case "03":
      return "Ground";
    case "12":
      return "3 Day Select";
    case "13":
      return "Next Day Air Saver";
    case "14":
      return "Next Day Air Early";
    case "59":
      return "2nd Day Air A.M.";
    default:
      return `Service ${code}`;
  }
}

function displayServiceName(code: string, raw?: string): string {
  const mapped = serviceName(code);
  if (!mapped.startsWith("Service")) return `UPS ${mapped}`;
  if (raw?.trim()) return raw.startsWith("UPS") ? raw : `UPS ${raw}`;
  return `UPS ${mapped}`;
}

export async function quoteCheckoutShippingOptions(shipping: ShippingAddress): Promise<{
  amount: number;
  code: string;
  name: string;
}[]> {
  const rates = await quoteUpsRates(shipping);
  const preferred = rates.filter((row) => CHECKOUT_SERVICE_CODES.has(row.code));
  const list = (preferred.length > 0 ? preferred : rates)
    .map((row) => {
      const amount = Math.round(Number(row.amount) * 100) / 100;
      return {
        amount,
        code: row.code,
        name: displayServiceName(row.code, row.name),
      };
    })
    .filter((row) => Number.isFinite(row.amount) && row.amount >= 0);

  const seen = new Set<string>();
  return list
    .filter((row) => {
      if (seen.has(row.code)) return false;
      seen.add(row.code);
      return true;
    })
    .sort((a, b) => a.amount - b.amount);
}
