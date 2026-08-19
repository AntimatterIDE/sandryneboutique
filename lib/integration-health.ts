import "server-only";

import { heartlandConfigured, porticoDeveloperId, porticoVersionNumber } from "@/lib/heartland";
import { heartlandRetailConfigured } from "@/lib/heartland-retail";
import { hcaptchaConfigured, hcaptchaUsingTestKeys } from "@/lib/hcaptcha";

export type HealthStatus = "ok" | "warn" | "missing" | "error";

export interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
  /** Non-secret preview, e.g. key prefix or numeric id */
  valuePreview?: string;
}

export interface IntegrationHealthReport {
  checkedAt: string;
  overall: HealthStatus;
  env: HealthCheckItem[];
  live: HealthCheckItem[];
  tips: string[];
}

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim() && !value.includes("your_") && value !== "0");
}

function maskKey(value: string | undefined, keep = 12): string | undefined {
  if (!value) return undefined;
  if (value.length <= keep) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, keep)}…`;
}

function envCheck(
  id: string,
  label: string,
  value: string | undefined,
  opts?: { numeric?: boolean; optional?: boolean; preview?: string }
): HealthCheckItem {
  const raw = value?.trim() ?? "";
  if (!raw || raw.includes("your_") || (opts?.numeric && (raw === "0" || Number(raw) <= 0))) {
    return {
      id,
      label,
      status: opts?.optional ? "warn" : "missing",
      detail: opts?.optional ? "Optional — not set." : "Missing or still a placeholder.",
    };
  }
  return {
    id,
    label,
    status: "ok",
    detail: "Set",
    valuePreview: opts?.preview ?? (opts?.numeric ? raw : maskKey(raw)),
  };
}

function worstStatus(items: HealthCheckItem[]): HealthStatus {
  if (items.some((i) => i.status === "error" || i.status === "missing")) return "missing";
  if (items.some((i) => i.status === "warn")) return "warn";
  return "ok";
}

async function pingRetailWhoami(): Promise<HealthCheckItem> {
  if (!heartlandRetailConfigured()) {
    return {
      id: "retail-live",
      label: "Retail API connection",
      status: "missing",
      detail: "Configure Retail env vars first.",
    };
  }

  const subdomain = process.env.HEARTLAND_RETAIL_SUBDOMAIN!;
  const url = `https://${subdomain}.retail.heartland.us/api/system/whoami`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.HEARTLAND_RETAIL_API_TOKEN}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return {
        id: "retail-live",
        label: "Retail API connection",
        status: "error",
        detail: `Auth failed (${res.status}). Check HEARTLAND_RETAIL_API_TOKEN.`,
      };
    }

    if (!res.ok) {
      return {
        id: "retail-live",
        label: "Retail API connection",
        status: "error",
        detail: `Retail responded ${res.status}. Check subdomain and token.`,
      };
    }

    const body = (await res.json().catch(() => null)) as {
      email?: string;
      name?: string;
      login?: string;
    } | null;

    const who =
      body?.email || body?.name || body?.login || "authenticated";

    return {
      id: "retail-live",
      label: "Retail API connection",
      status: "ok",
      detail: `Connected as ${who}`,
      valuePreview: subdomain,
    };
  } catch (err) {
    return {
      id: "retail-live",
      label: "Retail API connection",
      status: "error",
      detail: err instanceof Error ? err.message : "Network error reaching Retail.",
    };
  }
}

async function pingRetailLocation(): Promise<HealthCheckItem> {
  if (!heartlandRetailConfigured()) {
    return {
      id: "retail-location",
      label: "Retail location",
      status: "missing",
      detail: "Configure Retail env vars first.",
    };
  }

  const locationId = process.env.HEARTLAND_RETAIL_LOCATION_ID!;
  const subdomain = process.env.HEARTLAND_RETAIL_SUBDOMAIN!;
  const url = `https://${subdomain}.retail.heartland.us/api/locations/${locationId}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.HEARTLAND_RETAIL_API_TOKEN}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        id: "retail-location",
        label: "Retail location",
        status: "error",
        detail: `Location ${locationId} not found or inaccessible (${res.status}).`,
        valuePreview: locationId,
      };
    }

    const body = (await res.json().catch(() => null)) as { name?: string; id?: number } | null;
    return {
      id: "retail-location",
      label: "Retail location",
      status: "ok",
      detail: body?.name ? `Found “${body.name}”` : `Location ${locationId} OK`,
      valuePreview: locationId,
    };
  } catch (err) {
    return {
      id: "retail-location",
      label: "Retail location",
      status: "error",
      detail: err instanceof Error ? err.message : "Could not verify location.",
      valuePreview: locationId,
    };
  }
}

/**
 * Server-only health report for admin dashboard.
 * Never returns full secrets — only presence + masked previews + live pings.
 */
export async function getIntegrationHealth(): Promise<IntegrationHealthReport> {
  const publicKey = process.env.NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY;
  const isCert = publicKey?.includes("_cert_");
  const isProd = publicKey?.includes("_prod_");

  const env: HealthCheckItem[] = [
    envCheck("supabase-url", "Supabase URL", process.env.NEXT_PUBLIC_SUPABASE_URL, {
      preview: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^https?:\/\//, "").slice(0, 40),
    }),
    envCheck("supabase-anon", "Supabase anon key", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    envCheck("supabase-service", "Supabase service role", process.env.SUPABASE_SERVICE_ROLE_KEY),
    envCheck("site-url", "Site URL", process.env.NEXT_PUBLIC_SITE_URL, {
      preview: process.env.NEXT_PUBLIC_SITE_URL,
    }),
    envCheck("portico-public", "Portico public key", publicKey, {
      preview: maskKey(publicKey, 18),
    }),
    envCheck("portico-secret", "Portico secret key", process.env.HEARTLAND_SECRET_KEY, {
      preview: maskKey(process.env.HEARTLAND_SECRET_KEY, 18),
    }),
    envCheck("developer-id", "Portico developer ID", porticoDeveloperId(), {
      preview: porticoDeveloperId(),
    }),
    envCheck("version-number", "Portico version number", porticoVersionNumber(), {
      preview: porticoVersionNumber(),
    }),
    envCheck("hcaptcha-site", "hCaptcha site key", process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY, {
      preview: maskKey(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY, 18),
    }),
    envCheck("hcaptcha-secret", "hCaptcha secret", process.env.HCAPTCHA_SECRET_KEY),
    envCheck("retail-subdomain", "Retail subdomain", process.env.HEARTLAND_RETAIL_SUBDOMAIN, {
      preview: process.env.HEARTLAND_RETAIL_SUBDOMAIN,
    }),
    envCheck("retail-token", "Retail API token", process.env.HEARTLAND_RETAIL_API_TOKEN),
    envCheck("retail-station", "Retail station ID", process.env.HEARTLAND_RETAIL_STATION_ID, {
      numeric: true,
    }),
    envCheck("retail-location", "Retail location ID", process.env.HEARTLAND_RETAIL_LOCATION_ID, {
      numeric: true,
    }),
    envCheck(
      "retail-payment",
      "Retail web payment type",
      process.env.HEARTLAND_RETAIL_WEB_PAYMENT_TYPE,
      { numeric: true }
    ),
    envCheck("cron-secret", "Cron secret", process.env.CRON_SECRET),
  ];

  if (publicKey && isCert) {
    env.push({
      id: "portico-mode",
      label: "Portico mode",
      status: "warn",
      detail: "Sandbox (cert) keys — good for testing, not live cards.",
      valuePreview: "cert",
    });
  } else if (publicKey && isProd) {
    env.push({
      id: "portico-mode",
      label: "Portico mode",
      status: "ok",
      detail: "Production keys detected.",
      valuePreview: "prod",
    });
  }

  const [whoami, location] = await Promise.all([pingRetailWhoami(), pingRetailLocation()]);

  const live: HealthCheckItem[] = [
    {
      id: "portico-config",
      label: "Portico charge config",
      status: heartlandConfigured() ? "ok" : "missing",
      detail: heartlandConfigured()
        ? "Secret key present — checkout can charge."
        : "HEARTLAND_SECRET_KEY missing.",
    },
    {
      id: "retail-config",
      label: "Retail sync config",
      status: heartlandRetailConfigured() ? "ok" : "missing",
      detail: heartlandRetailConfigured()
        ? "All Retail IDs set — orders can sync inventory."
        : "Retail env incomplete — website sales won’t update Heartland inventory.",
    },
    whoami,
    location,
    {
      id: "hcaptcha-live",
      label: "hCaptcha",
      status: !hcaptchaConfigured()
        ? "missing"
        : hcaptchaUsingTestKeys()
          ? "warn"
          : "ok",
      detail: !hcaptchaConfigured()
        ? "Not configured — checkout will skip the widget."
        : hcaptchaUsingTestKeys()
          ? "Publisher test keys — replace with a real hCaptcha pair before signing Heartland’s form or going live."
          : "Checkout requires a passing hCaptcha before charging.",
    },
    {
      id: "velocity",
      label: "Checkout velocity limit",
      status: "ok",
      detail: "5 charge attempts per IP per 10 minutes.",
    },
  ];

  const tips: string[] = [];
  if (!present(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    tips.push("Run supabase/migrations/007_heartland_retail.sql in the Supabase SQL Editor.");
  }
  if (porticoDeveloperId() !== "002914" || porticoVersionNumber() !== "6401") {
    tips.push("Set HEARTLAND_DEVELOPER_ID=002914 and HEARTLAND_VERSION_NUMBER=6401 (assigned for Sandryne Boutique).");
  }
  if (isCert) {
    tips.push(
      "Use Admin → Certification on the Vercel staging URL to run the Secure Submit script. Do not use public checkout — that would decrement live Retail stock."
    );
  }
  if (heartlandRetailConfigured()) {
    tips.push(
      "In Admin → Products, Look up a Heartland item ID and save so the product can be sold online."
    );
  }
  tips.push(
    "After changing Vercel env vars, trigger a Redeploy so the new values load."
  );

  const overall = worstStatus([...env, ...live]);

  return {
    checkedAt: new Date().toISOString(),
    overall,
    env,
    live,
    tips,
  };
}
