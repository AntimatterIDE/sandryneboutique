import type { Metadata } from "next";
import Link from "next/link";
import { SITE_EMAIL, STORE_CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Sandryne Boutique — questions, styling advice, or store visits. Email info@sandryneboutique.com.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-4">
        Sandryne Boutique
      </p>
      <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-6">Contact Us</h1>
      <p className="text-muted-foreground leading-relaxed mb-12">
        We’d love to hear from you. Whether you have a question, need styling advice, or simply wish
        to share your thoughts, our team is here to connect.
      </p>

      <div className="space-y-8 text-sm">
        <div>
          <h2 className="text-[12px] tracking-[0.22em] uppercase mb-3">Email</h2>
          <a
            href={`mailto:${SITE_EMAIL}`}
            className="text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {SITE_EMAIL}
          </a>
        </div>

        <div>
          <h2 className="text-[12px] tracking-[0.22em] uppercase mb-3">Phone</h2>
          <a
            href={STORE_CONTACT.phoneHref}
            className="text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            {STORE_CONTACT.phoneDisplay}
          </a>
        </div>

        <div>
          <h2 className="text-[12px] tracking-[0.22em] uppercase mb-3">Visit</h2>
          <p className="text-muted-foreground leading-relaxed">
            {STORE_CONTACT.addressLines.join(", ")}
          </p>
          <p className="text-muted-foreground mt-1">{STORE_CONTACT.hours}</p>
          <p className="mt-3">
            <Link
              href="/visit"
              className="text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Store location & directions
            </Link>
          </p>
        </div>

        <div>
          <h2 className="text-[12px] tracking-[0.22em] uppercase mb-3">Returns</h2>
          <p className="text-muted-foreground leading-relaxed">
            Online returns require a Return Authorization Number (RA#). See our{" "}
            <Link
              href="/policies/returns"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Refund Policy
            </Link>{" "}
            for details.
          </p>
        </div>
      </div>
    </div>
  );
}
