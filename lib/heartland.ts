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

export function heartlandIsCertMode(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY ?? "";
  const secretKey = process.env.HEARTLAND_SECRET_KEY ?? "";
  return publicKey.includes("_cert_") || secretKey.includes("_cert_");
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const config = new PorticoConfig();
  config.secretApiKey = process.env.HEARTLAND_SECRET_KEY!;
  config.developerId = process.env.HEARTLAND_DEVELOPER_ID || "000000";
  config.versionNumber = process.env.HEARTLAND_VERSION_NUMBER || "0000";
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

function gatewayError(err: unknown, fallback: string): ChargeResult {
  console.error("Heartland request failed:", err);
  const message = err instanceof Error && err.message ? err.message : fallback;
  return { ok: false, message: fallback, responseCode: message };
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
