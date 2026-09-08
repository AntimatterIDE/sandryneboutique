import "server-only";
import {
  Address,
  CreditCardData,
  EcommerceInfo,
  PorticoConfig,
  ServicesContainer,
  Transaction,
} from "globalpayments-api";

export function heartlandConfigured(): boolean {
  return Boolean(process.env.HEARTLAND_SECRET_KEY);
}

export type HeartlandKeyEnv = "cert" | "prod" | "unknown";

export function heartlandKeyEnv(key: string | undefined): HeartlandKeyEnv {
  const value = key ?? "";
  if (value.includes("_cert_")) return "cert";
  if (value.includes("_prod_")) return "prod";
  return "unknown";
}

export function heartlandPublicKeyEnv(): HeartlandKeyEnv {
  return heartlandKeyEnv(process.env.NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY);
}

export function heartlandSecretKeyEnv(): HeartlandKeyEnv {
  return heartlandKeyEnv(process.env.HEARTLAND_SECRET_KEY);
}

export function heartlandIsCertMode(): boolean {
  return heartlandPublicKeyEnv() === "cert" || heartlandSecretKeyEnv() === "cert";
}

/** Public and secret keys must be the same environment or Portico throws. */
export function heartlandKeyMismatchMessage(): string | null {
  const publicEnv = heartlandPublicKeyEnv();
  const secretEnv = heartlandSecretKeyEnv();
  if (publicEnv === "unknown" || secretEnv === "unknown" || publicEnv === secretEnv) {
    return null;
  }
  return `Heartland public key is ${publicEnv} but the secret key is ${secretEnv}. Both must be pkapi_prod_ / skapi_prod_ to charge a live card.`;
}

/** Assigned for Sandryne Boutique. Treat Heartland placeholders as unset. */
export function porticoDeveloperId(): string {
  const raw = process.env.HEARTLAND_DEVELOPER_ID?.trim();
  if (!raw || raw === "000000") return "002914";
  return raw;
}

export function porticoVersionNumber(): string {
  const raw = process.env.HEARTLAND_VERSION_NUMBER?.trim();
  if (!raw || raw === "0000") return "6401";
  return raw;
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const config = new PorticoConfig();
  config.secretApiKey = process.env.HEARTLAND_SECRET_KEY!;
  config.developerId = porticoDeveloperId();
  config.versionNumber = porticoVersionNumber();
  ServicesContainer.configureService(config);
  configured = true;
}

export function newInvoiceNumber(prefix = "SB"): string {
  const raw = `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toUpperCase();
}

function ecommerceInfoForToday(date = new Date()): EcommerceInfo {
  const info = new EcommerceInfo();
  info.shipDay = String(date.getDate());
  info.shipMonth = String(date.getMonth() + 1);
  return info;
}

export interface ChargeInput {
  /** Single-use payment token from Heartland hosted fields */
  token: string;
  /** Amount in dollars */
  amount: number;
  postalCode: string;
  streetAddress: string;
  invoiceNumber?: string;
  allowDuplicates?: boolean;
}

export interface ChargeResult {
  ok: boolean;
  transactionId?: string;
  invoiceNumber?: string;
  message?: string;
  responseCode?: string;
  avsResponseCode?: string;
  cvnResponseCode?: string;
}

function gatewayResult(
  response: Transaction,
  invoiceNumber?: string
): ChargeResult {
  if (response.responseCode === "00") {
    return {
      ok: true,
      transactionId: response.transactionId,
      invoiceNumber,
      responseCode: response.responseCode,
      avsResponseCode: response.avsResponseCode,
      cvnResponseCode: response.cvnResponseCode,
    };
  }
  return {
    ok: false,
    transactionId: response.transactionId,
    invoiceNumber,
    responseCode: response.responseCode,
    avsResponseCode: response.avsResponseCode,
    cvnResponseCode: response.cvnResponseCode,
    message: declineMessage(response.responseCode, response.responseMessage),
  };
}

function sanitizeGatewayMessage(raw: string): string {
  return raw
    .replace(/skapi_[A-Za-z0-9_]+/g, "[secret]")
    .replace(/pkapi_[A-Za-z0-9_]+/g, "[public]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function extractGatewayMessage(err: unknown): string | undefined {
  if (!err || typeof err !== "object") {
    return typeof err === "string" ? err : undefined;
  }
  const record = err as {
    message?: unknown;
    responseMessage?: unknown;
    responseCode?: unknown;
  };
  const parts = [record.responseMessage, record.message, record.responseCode]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return parts[0];
}

function gatewayError(err: unknown, fallback: string): ChargeResult {
  console.error("Heartland request failed:", err);
  const extracted = extractGatewayMessage(err);
  const detail = extracted ? sanitizeGatewayMessage(extracted) : undefined;
  return {
    ok: false,
    message: detail ? `${fallback} (${detail})` : fallback,
    responseCode: detail ?? fallback,
  };
}

export async function chargeCard(input: ChargeInput): Promise<ChargeResult> {
  ensureConfigured();

  const card = new CreditCardData();
  card.token = input.token;

  const address = new Address();
  address.postalCode = input.postalCode;
  address.streetAddress1 = input.streetAddress;

  const invoiceNumber = input.invoiceNumber?.trim() || newInvoiceNumber();

  try {
    const response = await card
      .charge(input.amount)
      .withCurrency("USD")
      .withAddress(address)
      .withInvoiceNumber(invoiceNumber)
      .withEcommerceInfo(ecommerceInfoForToday())
      .withAllowDuplicates(Boolean(input.allowDuplicates))
      .execute();

    return gatewayResult(response, invoiceNumber);
  } catch (err) {
    return gatewayError(
      err,
      "We couldn't process your payment. Please check your card details and try again."
    );
  }
}

export interface RefundInput {
  token: string;
  amount: number;
  postalCode?: string;
  streetAddress?: string;
  invoiceNumber?: string;
  allowDuplicates?: boolean;
}

/** Unlinked CreditReturn (card token only). Do not use in production — Heartland requires GatewayTxnId. */
export async function refundCard(input: RefundInput): Promise<ChargeResult> {
  ensureConfigured();

  const card = new CreditCardData();
  card.token = input.token;

  const invoiceNumber = input.invoiceNumber?.trim() || newInvoiceNumber("RF");

  try {
    let builder = card
      .refund(input.amount)
      .withCurrency("USD")
      .withInvoiceNumber(invoiceNumber)
      .withEcommerceInfo(ecommerceInfoForToday())
      .withAllowDuplicates(Boolean(input.allowDuplicates));

    if (input.postalCode || input.streetAddress) {
      const address = new Address();
      if (input.postalCode) address.postalCode = input.postalCode;
      if (input.streetAddress) address.streetAddress1 = input.streetAddress;
      builder = builder.withAddress(address);
    }

    const response = await builder.execute();
    return gatewayResult(response, invoiceNumber);
  } catch (err) {
    return gatewayError(err, "We couldn't refund this card. Please try again.");
  }
}

/** CreditReturn tied to the original sale's GatewayTxnId. Required in production. */
export async function refundTransaction(
  transactionId: string,
  amount: number
): Promise<ChargeResult> {
  ensureConfigured();

  try {
    const response = await Transaction.fromId(transactionId)
      .refund(amount)
      .withCurrency("USD")
      .execute();
    return gatewayResult(response);
  } catch (err) {
    return gatewayError(err, "We couldn't refund this transaction. Please try again.");
  }
}

export async function reverseTransaction(
  transactionId: string,
  amount: number
): Promise<ChargeResult> {
  ensureConfigured();

  try {
    const response = await Transaction.fromId(transactionId)
      .reverse(amount)
      .withCurrency("USD")
      .execute();
    return gatewayResult(response);
  } catch (err) {
    return gatewayError(err, "We couldn't reverse this transaction. Please try again.");
  }
}

export async function voidTransaction(transactionId: string): Promise<ChargeResult> {
  ensureConfigured();

  try {
    const response = await Transaction.fromId(transactionId).void().execute();
    return gatewayResult(response);
  } catch (err) {
    return gatewayError(err, "We couldn't void this transaction. Please try again.");
  }
}

function declineMessage(code: string | undefined, raw: string | undefined): string {
  switch (code) {
    case "02":
    case "03":
    case "05":
      return "Your card was declined. Please try a different card or contact your bank.";
    case "51":
      return "Your card was declined due to insufficient funds.";
    case "54":
      return "Your card has expired. Please use a different card.";
    default:
      return raw
        ? `Payment failed: ${raw}. Please try again.`
        : "Payment failed. Please try again.";
  }
}
