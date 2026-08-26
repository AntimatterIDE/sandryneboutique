import type { Metadata } from "next";
import Link from "next/link";
import { CertificationRunner } from "@/components/admin/certification-runner";
import {
  CERT_GATEWAY_LOGIN_URL,
  CERT_REVIEW_FORM_URL,
  CERT_TEST_CARDS_URL,
} from "@/lib/heartland-cert-script";
import { heartlandIsCertMode, porticoDeveloperId, porticoVersionNumber } from "@/lib/heartland";

export const metadata: Metadata = {
  title: "Certification",
};

export const dynamic = "force-dynamic";

export default function AdminCertificationPage() {
  const publicKey = process.env.NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY || null;
  const certMode = heartlandIsCertMode();
  const developerId = porticoDeveloperId();
  const versionNumber = porticoVersionNumber();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl tracking-tight">Portico certification</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Run the Secure Submit script against the cert gateway only. These charges do not
          create boutique orders and do not sync to Heartland Retail inventory.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3 text-sm border border-foreground/10 p-4">
        <p>
          <span className="block text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
            Mode
          </span>
          {certMode ? "Cert / sandbox keys" : "Production keys — script is blocked"}
        </p>
        <p>
          <span className="block text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
            Developer ID
          </span>
          <span className="font-mono">{developerId}</span>
        </p>
        <p>
          <span className="block text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
            Version
          </span>
          <span className="font-mono">{versionNumber}</span>
        </p>
      </div>

      {!certMode ? (
        <p className="text-sm text-destructive">
          This page will not send script amounts while production API keys are loaded. Keep{" "}
          <code className="text-xs">pkapi_cert_</code> / <code className="text-xs">skapi_cert_</code>{" "}
          on this Vercel staging project until Heartland issues the certification letter.
        </p>
      ) : null}

      {developerId !== "002914" || versionNumber !== "6401" ? (
        <p className="text-sm text-destructive">
          Set <code className="text-xs">HEARTLAND_DEVELOPER_ID=002914</code> and{" "}
          <code className="text-xs">HEARTLAND_VERSION_NUMBER=6401</code> in Vercel → Settings →
          Environment Variables for this staging deployment. Heartland will reject certification if
          these are missing on the requests.
        </p>
      ) : null}

      <section className="border border-foreground/10 bg-muted/30 px-4 py-4 sm:px-5 space-y-2 text-sm leading-relaxed">
        <p className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
          After the six tests
        </p>
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>
            Confirm each txn in the{" "}
            <a href={CERT_GATEWAY_LOGIN_URL} className="underline underline-offset-2" target="_blank" rel="noreferrer">
              Portico cert gateway
            </a>{" "}
            (response 00, amounts in order, developer ID {developerId}, version {versionNumber}). Use
            the login from Jon Hawk&apos;s email — do not store it in git.
          </li>
          <li>
            Submit the{" "}
            <a href={CERT_REVIEW_FORM_URL} className="underline underline-offset-2" target="_blank" rel="noreferrer">
              CNP Certification Review Request
            </a>
            : software name Sandryne Boutique, Credit Sale + Refund (tied to original Gateway Trans
            ID) + Void/Reversal, ACH No.
          </li>
          <li>
            Tania (merchant), you (developer), and the RM sign the eCommerce Cyber Security
            Acknowledgement for controls that are actually on (hCaptcha, velocity; WAF if Vercel
            Attack Challenge is enabled). Do not mark KOUNT unless you bought it.
          </li>
          <li>
            Wait for the Certification Announcement Letter. Only then swap this Vercel project to{" "}
            <code className="text-xs">pkapi_prod_</code> / <code className="text-xs">skapi_prod_</code>{" "}
            and redeploy. Keep using this staging URL until you point the custom domain at it.
          </li>
          <li>
            Place one cheap live order on production and check: Portico charge,{" "}
            <Link href="/admin/orders" className="underline underline-offset-2">
              Admin → Orders
            </Link>{" "}
            shows the transaction ID, local inventory dropped, Retail sales order{" "}
            <code className="text-xs">heartland_sync_status = synced</code>. Void or refund that
            test charge immediately if it is not a real sale.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Extra test cards if the table below declines:{" "}
          <a href={CERT_TEST_CARDS_URL} className="underline underline-offset-2" target="_blank" rel="noreferrer">
            Heartland test card numbers
          </a>
          .
        </p>
      </section>

      <CertificationRunner publicKey={publicKey} />
    </div>
  );
}
