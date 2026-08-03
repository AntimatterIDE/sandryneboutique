import type { Metadata } from "next";
import { STORE_CONTACT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Come Visit Our Store",
  description:
    "Visit Sandryne Boutique at 415 Peachtree Parkway, Ste 235, Cumming, GA. Mon–Sat 10–6 PM.",
};

export default function VisitPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <div className="max-w-2xl mb-10">
        <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-4">
          Sandryne Boutique
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight mb-6">
          Come Visit Our Store
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Experience our curated collection of women&apos;s fashion and jewelry. Visit us to
          discover your next favorite piece.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
        <div className="space-y-6 text-sm">
          <div>
            <h2 className="text-[12px] tracking-[0.22em] uppercase mb-3">Address</h2>
            {STORE_CONTACT.addressLines.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <div>
            <h2 className="text-[12px] tracking-[0.22em] uppercase mb-3">Hours</h2>
            <p className="text-muted-foreground">{STORE_CONTACT.hours}</p>
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
          <a
            href={STORE_CONTACT.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center border border-foreground bg-foreground px-6 text-xs tracking-[0.16em] uppercase text-background hover:opacity-90 transition-opacity"
          >
            Get Directions
          </a>
        </div>

        <div className="relative aspect-[4/3] w-full overflow-hidden border border-foreground/10 bg-muted">
          <iframe
            title="Sandryne Boutique on Google Maps"
            src={STORE_CONTACT.mapsEmbedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
