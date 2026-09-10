import "server-only";
import {
  Address,
  CreditCardData,
  EcommerceInfo,
  Environment,
  PaymentMethodType,
  PorticoConfig,
  ReportingService,
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
  const secretApiKey = process.env.HEARTLAND_SECRET_KEY?.trim() ?? "";
  const config = new PorticoConfig();
  config.secretApiKey = secretApiKey;
  config.developerId = porticoDeveloperId();
  config.versionNumber = porticoVersionNumber();
  // globalpayments-api defaults environment to Test (cert). Prod secret keys
  // sent to cert.api2 return Portico -2 Authentication Error.
  config.environment =
    heartlandKeyEnv(secretApiKey) === "prod" ? Environment.Production : Environment.Test;
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

/** Portico AVS uses digits. US ZIP+4 and extra punctuation cause false mismatches. */
export function sanitizePostalCode(raw: string, country?: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 10);
  const isUS = !country || /united states|^usa$|^us$/i.test(country.trim());
  if (isUS) {
    const digits = cleaned.replace(/\D/g, "");
    return digits.slice(0, 5);
  }
  return cleaned;
}

export interface ChargeInput {
  /** Single-use payment token from Heartland hosted fields */
  token: string;
  /** Amount in dollars */
  amount: number;
  postalCode: string;
  streetAddress: string;
  country?: string;
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

const SUCCESS_CODES = new Set(["00", "0", "85", "10"]);

function gatewayResult(
  response: Transaction,
  invoiceNumber?: string
): ChargeResult {
  if (SUCCESS_CODES.has(response.responseCode ?? "")) {
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
  address.postalCode = sanitizePostalCode(input.postalCode, input.country);
  address.streetAddress1 = input.streetAddress.trim();

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

function porticoTransaction(transactionId: string): Transaction {
  return Transaction.fromId(String(transactionId).trim(), PaymentMethodType.Credit);
}

function moneyString(value: number | string | undefined, fallback: number): string {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0) {
    return parsed.toFixed(2);
  }
  return fallback.toFixed(2);
}

/** CreditReturn tied to the original sale's GatewayTxnId. Required in production. */
export async function refundTransaction(
  transactionId: string,
  amount: number | string
): Promise<ChargeResult> {
  ensureConfigured();

  try {
    const response = await porticoTransaction(transactionId)
      .refund(moneyString(amount, Number(amount)))
      .withCurrency("USD")
      .execute();
    return gatewayResult(response);
  } catch (err) {
    return gatewayError(err, "We couldn't refund this transaction. Please try again.");
  }
}

export async function reverseTransaction(
  transactionId: string,
  amount: number | string
): Promise<ChargeResult> {
  ensureConfigured();

  try {
    const response = await porticoTransaction(transactionId)
      .reverse(moneyString(amount, Number(amount)))
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
    const response = await porticoTransaction(transactionId).void().execute();
    return gatewayResult(response);
  } catch (err) {
    return gatewayError(err, "We couldn't void this transaction. Please try again.");
  }
}

type PorticoTxnSnapshot = {
  status?: string;
  authorizedAmount?: string;
  settlementAmount?: string;
};

function parsePorticoStatus(raw?: string): string {
  return (raw ?? "").trim().toUpperCase();
}

function isAlreadyReleased(status?: string): boolean {
  const value = parsePorticoStatus(status);
  return (
    value === "V" ||
    value === "R" ||
    value === "I" ||
    value === "X" ||
    value.includes("VOID") ||
    value.includes("REVERS") ||
    value.includes("INACTIVE")
  );
}

function resultText(result: ChargeResult): string {
  return `${result.responseCode ?? ""} ${result.message ?? ""}`.toLowerCase();
}

/** Portico blocks void/reverse after any CreditReturn is tied to the sale. */
function isExistingReturnError(result: ChargeResult): boolean {
  const text = resultText(result);
  return text.includes("return against it") || text.includes("has a return");
}

function isZeroSettlementReturnError(result: ChargeResult): boolean {
  const text = resultText(result);
  return (
    text.includes("exceeds the original settlement") ||
    text.includes("return amount is zero") ||
    text.includes("gateway response: 6")
  );
}

function alreadyReturnedResult(transactionId: string): ChargeResult {
  return {
    ok: true,
    transactionId,
    responseCode: "00",
    message: "Heartland already has a return on this charge.",
  };
}

async function lookupPorticoTransaction(transactionId: string): Promise<PorticoTxnSnapshot | null> {
  ensureConfigured();
  try {
    const detail = await ReportingService.transactionDetail(String(transactionId).trim()).execute();
    return {
      status: detail?.status ?? detail?.transactionStatus,
      authorizedAmount: detail?.authorizedAmount,
      settlementAmount: detail?.settlementAmount,
    };
  } catch (err) {
    console.error("Heartland ReportTxnDetail failed:", err);
    return null;
  }
}

/**
 * Same-day pending sales must be voided or reversed. Refund (CreditReturn)
 * only works after Heartland settles the batch — otherwise Portico returns 6.
 * If a prior attempt already released the hold, treat that as success.
 */
export async function returnCardFunds(
  transactionId: string,
  amount: number,
  options?: { preserveRemainder?: boolean }
): Promise<ChargeResult> {
  const dollars = Math.round(amount * 100) / 100;
  if (!Number.isFinite(dollars) || dollars <= 0) {
    return { ok: false, message: "There is no remaining amount to return on this card." };
  }

  const preserveRemainder = Boolean(options?.preserveRemainder);
  const snapshot = await lookupPorticoTransaction(transactionId);
  if (snapshot && isAlreadyReleased(snapshot.status)) {
    return alreadyReturnedResult(transactionId);
  }

  const settlement = Number(snapshot?.settlementAmount);
  const settlementKnown = Number.isFinite(settlement);
  if (settlementKnown && settlement <= 0) {
    return alreadyReturnedResult(transactionId);
  }

  // Full reverse/void would also return shipping. Keep a partial amount authorized.
  const reverseAmount = preserveRemainder
    ? moneyString(dollars, dollars)
    : moneyString(snapshot?.authorizedAmount, dollars);
  const refundAmount = settlementKnown
    ? moneyString(Math.min(dollars, settlement), dollars)
    : moneyString(dollars, dollars);
  const status = parsePorticoStatus(snapshot?.status);
  const settled = status === "C" || status === "CLEARED" || status === "CLOSED";

  const attempts: ChargeResult[] = [];

  if (!settled) {
    if (!preserveRemainder) {
      const voided = await voidTransaction(transactionId);
      attempts.push(voided);
      if (voided.ok) return voided;
      if (isExistingReturnError(voided)) return alreadyReturnedResult(transactionId);
    }

    const reversed = await reverseTransaction(transactionId, reverseAmount);
    attempts.push(reversed);
    if (reversed.ok) return reversed;
    if (isExistingReturnError(reversed)) return alreadyReturnedResult(transactionId);

    const again = await lookupPorticoTransaction(transactionId);
    if (again && (isAlreadyReleased(again.status) || Number(again.settlementAmount) <= 0)) {
      return alreadyReturnedResult(transactionId);
    }
  }

  if (Number(refundAmount) > 0) {
    const refunded = await refundTransaction(transactionId, refundAmount);
    attempts.push(refunded);
    if (refunded.ok) return refunded;
    if (isExistingReturnError(refunded) || isZeroSettlementReturnError(refunded)) {
      return alreadyReturnedResult(transactionId);
    }
  }

  console.error("Heartland returnCardFunds failed:", {
    transactionId,
    status: snapshot?.status,
    authorizedAmount: snapshot?.authorizedAmount,
    settlementAmount: snapshot?.settlementAmount,
    attempts: attempts.map((result) => result.message),
  });

  const last = [...attempts].reverse().find((result) => result.message);
  return {
    ok: false,
    message: preserveRemainder
      ? "This sale may still be settling. Wait until it batches (usually overnight), then refund the item price only."
      : last?.message || "We couldn't return this charge. Please try again.",
    responseCode: last?.responseCode,
  };
}

function declineMessage(code: string | undefined, raw: string | undefined): string {
  const text = raw?.toUpperCase() ?? "";
  if (code === "04" || text.includes("AVS") || text.includes("CVV")) {
    return "The billing ZIP or security code did not match the card. Enter the address on your card statement and try again.";
  }
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
