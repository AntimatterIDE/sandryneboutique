"use server";

import { isAdmin } from "@/lib/auth";
import {
  CERT_REFUND_TEST,
  CERT_REVERSE_TEST,
  CERT_SALE_TESTS,
  type CertSaleTest,
} from "@/lib/heartland-cert-script";
import {
  chargeCard,
  heartlandConfigured,
  heartlandIsCertMode,
  refundTransaction,
  reverseTransaction,
  type ChargeResult,
} from "@/lib/heartland";

export type CertActionResult = ChargeResult & {
  testId: string;
  label: string;
};

async function requireAdmin(): Promise<string | null> {
  if (!(await isAdmin())) return "You are not authorized to run certification transactions.";
  if (!heartlandConfigured()) return "Heartland secret key is not configured.";
  return null;
}

function saleTest(id: string): CertSaleTest | undefined {
  return CERT_SALE_TESTS.find((t) => t.id === id);
}

export async function runCertSale(input: {
  token: string;
  testId: string;
}): Promise<CertActionResult> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, message: authError, testId: input.testId, label: "Sale" };

  const test = saleTest(input.testId);
  if (!test) {
    return { ok: false, message: "Unknown certification sale test.", testId: input.testId, label: "Sale" };
  }
  if (!input.token) {
    return { ok: false, message: "Missing payment token. Re-enter the card.", testId: test.id, label: `Sale ${test.id}` };
  }
  if (!heartlandIsCertMode()) {
    return {
      ok: false,
      message: "Refusing to run the cert script against production keys. Switch to pkapi_cert_ / skapi_cert_.",
      testId: test.id,
      label: `Sale ${test.id}`,
    };
  }

  const result = await chargeCard({
    token: input.token,
    amount: test.amount,
    streetAddress: test.streetAddress,
    postalCode: test.postalCode,
    invoiceNumber: `CERT${test.id}${Date.now().toString(36).slice(-6)}`.toUpperCase().slice(0, 16),
    allowDuplicates: true,
  });

  return {
    ...result,
    testId: test.id,
    label: `Sale ${test.id} ${test.brand} $${test.amount.toFixed(2)}`,
  };
}

export async function runCertRefund(input: {
  transactionId: string;
}): Promise<CertActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return { ok: false, message: authError, testId: CERT_REFUND_TEST.id, label: "Refund 34" };
  }

  const transactionId = input.transactionId.trim();
  if (!transactionId) {
    return {
      ok: false,
      message: "Paste the gateway transaction ID from test 10 (Mastercard $17.02).",
      testId: CERT_REFUND_TEST.id,
      label: "Refund 34",
    };
  }
  if (!heartlandIsCertMode()) {
    return {
      ok: false,
      message: "Refusing to run the cert script against production keys.",
      testId: CERT_REFUND_TEST.id,
      label: "Refund 34",
    };
  }

  const result = await refundTransaction(transactionId, CERT_REFUND_TEST.amount);
  return {
    ...result,
    testId: CERT_REFUND_TEST.id,
    label: `Refund 34 of txn ${transactionId} ($${CERT_REFUND_TEST.amount.toFixed(2)})`,
  };
}

export async function runCertReverse(input: {
  transactionId: string;
}): Promise<CertActionResult> {
  const authError = await requireAdmin();
  if (authError) {
    return { ok: false, message: authError, testId: CERT_REVERSE_TEST.id, label: "Reverse 35" };
  }

  const transactionId = input.transactionId.trim();
  if (!transactionId) {
    return {
      ok: false,
      message: "Paste the gateway transaction ID from test 9 (Visa $17.01).",
      testId: CERT_REVERSE_TEST.id,
      label: "Reverse 35",
    };
  }
  if (!heartlandIsCertMode()) {
    return {
      ok: false,
      message: "Refusing to run the cert script against production keys.",
      testId: CERT_REVERSE_TEST.id,
      label: "Reverse 35",
    };
  }

  const result = await reverseTransaction(transactionId, CERT_REVERSE_TEST.amount);
  return {
    ...result,
    testId: CERT_REVERSE_TEST.id,
    label: `Reverse 35 of txn ${transactionId} ($${CERT_REVERSE_TEST.amount.toFixed(2)})`,
  };
}
