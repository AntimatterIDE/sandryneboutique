"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  runCertRefund,
  runCertReverse,
  runCertSale,
  type CertActionResult,
} from "@/app/admin/certification/actions";
import {
  CERT_REFUND_TEST,
  CERT_REVERSE_TEST,
  CERT_SALE_TESTS,
  HEARTLAND_TEST_CARDS,
} from "@/lib/heartland-cert-script";

interface TokenSuccessResponse {
  paymentReference: string;
}

interface TokenErrorResponse {
  error?: { message?: string };
  reasons?: { message?: string }[];
}

interface HostedCardForm {
  on(event: "token-success", handler: (resp: TokenSuccessResponse) => void): void;
  on(event: "token-error", handler: (resp: TokenErrorResponse) => void): void;
}

declare global {
  interface Window {
    GlobalPayments?: {
      configure(options: { publicApiKey: string }): void;
      creditCard: {
        form(target: string, options?: { style?: string }): HostedCardForm;
      };
    };
  }
}

type PendingOp = { type: "sale"; testId: string };

function resultLine(result: CertActionResult): string {
  const bits = [
    result.ok ? "OK" : "FAIL",
    result.label,
    result.transactionId ? `txn ${result.transactionId}` : null,
    result.responseCode ? `code ${result.responseCode}` : null,
    result.avsResponseCode ? `AVS ${result.avsResponseCode}` : null,
    result.cvnResponseCode ? `CVV ${result.cvnResponseCode}` : null,
    result.invoiceNumber ? `inv ${result.invoiceNumber}` : null,
    result.message,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function CertificationRunner({ publicKey }: { publicKey: string | null }) {
  const [scriptReady, setScriptReady] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);
  const [pending, setPending] = useState<PendingOp | null>(null);
  const [processing, setProcessing] = useState(false);
  const [visaTxnId, setVisaTxnId] = useState("");
  const [mcTxnId, setMcTxnId] = useState("");
  const [log, setLog] = useState<CertActionResult[]>([]);
  const pendingRef = useRef<PendingOp | null>(null);
  const formMounted = useRef(false);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const appendResult = useCallback((result: CertActionResult) => {
    setLog((prev) => [result, ...prev]);
    if (result.ok && result.testId === "9" && result.transactionId) {
      setVisaTxnId(result.transactionId);
    }
    if (result.ok && result.testId === "10" && result.transactionId) {
      setMcTxnId(result.transactionId);
    }
    if (result.ok) {
      toast.success(result.label);
    } else {
      toast.error(result.message ?? result.label);
    }
  }, []);

  const handleToken = useCallback(
    async (token: string) => {
      const op = pendingRef.current;
      if (!op) {
        toast.error("Select a test first, then complete the card form.");
        return;
      }
      setProcessing(true);
      try {
        const result = await runCertSale({ token, testId: op.testId });
        appendResult(result);
      } catch (err) {
        console.error("Cert transaction failed:", err);
        toast.error("Request failed. See the browser console.");
      } finally {
        setProcessing(false);
        setPending(null);
        pendingRef.current = null;
        formMounted.current = false;
        setFormEpoch((n) => n + 1);
      }
    },
    [appendResult]
  );

  useEffect(() => {
    if (!scriptReady || !publicKey || formMounted.current || !window.GlobalPayments) return;
    formMounted.current = true;
    window.GlobalPayments.configure({ publicApiKey: publicKey });
    const cardForm = window.GlobalPayments.creditCard.form("#heartland-cert-card", {
      style: "default",
    });
    cardForm.on("token-success", (resp) => {
      void handleToken(resp.paymentReference);
    });
    cardForm.on("token-error", (resp) => {
      const message =
        resp.reasons?.[0]?.message ??
        resp.error?.message ??
        "Card tokenization failed. Check the number, expiry, and CVV.";
      toast.error(message);
    });
  }, [scriptReady, publicKey, formEpoch, handleToken]);

  const selectSale = (testId: string) => {
    const next: PendingOp = { type: "sale", testId };
    setPending(next);
    pendingRef.current = next;
    toast.message(`Test ${testId} armed — complete the card form with that brand.`);
  };

  const runRefund = async () => {
    setProcessing(true);
    try {
      const result = await runCertRefund({ transactionId: mcTxnId });
      appendResult(result);
    } catch (err) {
      console.error("Cert refund failed:", err);
      toast.error("Refund request failed.");
    } finally {
      setProcessing(false);
    }
  };

  const runReverse = async () => {
    setProcessing(true);
    try {
      const result = await runCertReverse({ transactionId: visaTxnId });
      appendResult(result);
    } catch (err) {
      console.error("Cert reverse failed:", err);
      toast.error("Reverse request failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {publicKey && (
        <Script
          src="https://js.globalpay.com/4.1.26/globalpayments.js"
          onLoad={() => setScriptReady(true)}
        />
      )}

      <section className="border border-foreground/10 p-5 sm:p-6 space-y-4">
        <h2 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
          1–4 · Credit sales (tests 9–12)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Arm a test, then fill the hosted card form with that brand. Amounts and AVS are sent
          server-side — this never creates a shop order or touches Retail inventory.
        </p>
        <ol className="space-y-3">
          {CERT_SALE_TESTS.map((test) => (
            <li
              key={test.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-foreground/8 px-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  Test {test.id} · {test.brand} · ${test.amount.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AVS {test.streetAddress}, {test.postalCode} · CVV {test.cvv} · {test.notes}
                </p>
              </div>
              <Button
                type="button"
                variant={pending?.type === "sale" && pending.testId === test.id ? "default" : "outline"}
                className="rounded-none tracking-[0.12em] uppercase text-xs shrink-0"
                disabled={processing || !publicKey}
                onClick={() => selectSale(test.id)}
              >
                {pending?.type === "sale" && pending.testId === test.id ? "Armed" : "Arm sale"}
              </Button>
            </li>
          ))}
        </ol>
      </section>

      <section className="border border-foreground/10 p-5 sm:p-6 space-y-4">
        <h2 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
          Card form
        </h2>
        {pending ? (
          <p className="text-sm">
            Armed: <span className="font-medium">Sale {pending.testId}</span>. Complete the fields
            below.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Arm a sale before submitting a card.</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1.5 pr-3 font-normal">Brand</th>
                <th className="py-1.5 pr-3 font-normal">Test number</th>
                <th className="py-1.5 pr-3 font-normal">Exp</th>
                <th className="py-1.5 font-normal">CVV</th>
              </tr>
            </thead>
            <tbody>
              {HEARTLAND_TEST_CARDS.map((card) => (
                <tr key={card.brand} className="border-t border-foreground/8 font-mono">
                  <td className="py-1.5 pr-3">{card.brand}</td>
                  <td className="py-1.5 pr-3">{card.number}</td>
                  <td className="py-1.5 pr-3">{card.exp}</td>
                  <td className="py-1.5">{card.cvv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {publicKey ? (
          <>
            <div id="heartland-cert-card" key={formEpoch} className="min-h-28" />
            {!scriptReady && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading Heartland hosted fields…
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add <code className="text-xs">NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY</code> to enable the form.
          </p>
        )}

        {processing && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Sending to Portico cert…
          </div>
        )}
      </section>

      <section className="border border-foreground/10 p-5 sm:p-6 space-y-4">
        <h2 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
          5 · Refund (test 34)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{CERT_REFUND_TEST.notes}</p>
        <div className="space-y-1.5 max-w-md">
          <Label htmlFor="mc-txn">Test 10 transaction ID</Label>
          <Input
            id="mc-txn"
            value={mcTxnId}
            onChange={(e) => setMcTxnId(e.target.value)}
            placeholder="Filled automatically after a successful test 10"
            className="rounded-none font-mono text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-none tracking-[0.12em] uppercase text-xs"
          disabled={processing || !mcTxnId.trim()}
          onClick={() => void runRefund()}
        >
          Refund ${CERT_REFUND_TEST.amount.toFixed(2)} against original txn
        </Button>
      </section>

      <section className="border border-foreground/10 p-5 sm:p-6 space-y-4">
        <h2 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
          6 · Reverse (test 35)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{CERT_REVERSE_TEST.notes}</p>
        <div className="space-y-1.5 max-w-md">
          <Label htmlFor="visa-txn">Test 9 transaction ID</Label>
          <Input
            id="visa-txn"
            value={visaTxnId}
            onChange={(e) => setVisaTxnId(e.target.value)}
            placeholder="Filled automatically after a successful test 9"
            className="rounded-none font-mono text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-none tracking-[0.12em] uppercase text-xs"
          disabled={processing || !visaTxnId.trim()}
          onClick={() => void runReverse()}
        >
          Reverse $17.01
        </Button>
      </section>

      <section className="border border-foreground/10 p-5 sm:p-6 space-y-3">
        <h2 className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
          Results log
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cert transactions yet this session.</p>
        ) : (
          <ol className="space-y-2">
            {log.map((item, index) => (
              <li
                key={`${item.testId}-${index}-${item.transactionId ?? "x"}`}
                className="text-xs font-mono leading-relaxed"
              >
                <span className={item.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}>
                  {resultLine(item)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
