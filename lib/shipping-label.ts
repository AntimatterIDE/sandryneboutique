import "server-only";
import { STORE_CONTACT } from "@/lib/constants";
import type { ShippingAddress } from "@/lib/types";

export function shippingLabelsConfigured(): boolean {
  return Boolean(process.env.EASYPOST_API_KEY?.trim());
}

export interface PurchasedLabel {
  trackingNumber: string;
  carrier: string;
  labelUrl: string;
}

function fromAddress() {
  return {
    name: "Sandryne Boutique",
    company: "Sandryne Boutique",
    street1: STORE_CONTACT.addressLines[0],
    street2: "",
    city: "Cumming",
    state: "GA",
    zip: "30041",
    country: "US",
    phone: STORE_CONTACT.phoneDisplay.replace(/\D/g, "").slice(-10),
    email: STORE_CONTACT.email,
  };
}

function toAddress(shipping: ShippingAddress) {
  return {
    name: shipping.full_name,
    street1: shipping.line1,
    street2: shipping.line2 || undefined,
    city: shipping.city,
    state: shipping.state,
    zip: shipping.postal_code,
    country: shipping.country === "United States" ? "US" : shipping.country,
    phone: shipping.phone?.replace(/\D/g, "").slice(-10) || undefined,
    email: shipping.email,
  };
}

export async function buyUpsShippingLabel(
  shipping: ShippingAddress
): Promise<PurchasedLabel> {
  const key = process.env.EASYPOST_API_KEY?.trim();
  if (!key) {
    throw new Error("Add EASYPOST_API_KEY in Vercel to buy UPS labels from admin.");
  }

  const auth = Buffer.from(`${key}:`).toString("base64");
  const created = await fetch("https://api.easypost.com/v2/shipments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shipment: {
        to_address: toAddress(shipping),
        from_address: fromAddress(),
        parcel: {
          length: 12,
          width: 10,
          height: 3,
          weight: 16,
        },
      },
    }),
  });

  const shipment = (await created.json()) as {
    id?: string;
    rates?: { id: string; carrier: string; service: string; rate: string }[];
    error?: { message?: string };
  };

  if (!created.ok || !shipment.id) {
    throw new Error(shipment.error?.message || "EasyPost could not rate this shipment.");
  }

  const upsRates = (shipment.rates ?? []).filter((rate) =>
    rate.carrier.toLowerCase().includes("ups")
  );
  const pick = (upsRates.length > 0 ? upsRates : shipment.rates ?? [])
    .slice()
    .sort((a, b) => Number(a.rate) - Number(b.rate))[0];

  if (!pick) {
    throw new Error("No shipping rates returned. Check the address and EasyPost UPS account.");
  }

  const bought = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rate: { id: pick.id } }),
  });

  const paid = (await bought.json()) as {
    tracking_code?: string;
    selected_rate?: { carrier?: string; service?: string };
    postage_label?: { label_url?: string };
    error?: { message?: string };
  };

  if (!bought.ok || !paid.postage_label?.label_url || !paid.tracking_code) {
    throw new Error(paid.error?.message || "EasyPost could not purchase the UPS label.");
  }

  return {
    trackingNumber: paid.tracking_code,
    carrier: `${paid.selected_rate?.carrier ?? "UPS"} ${paid.selected_rate?.service ?? ""}`.trim(),
    labelUrl: paid.postage_label.label_url,
  };
}
