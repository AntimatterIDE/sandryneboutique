import Link from "next/link";
import {
  SITE_EMAIL,
  SITE_NAME,
  SOCIAL_LINKS,
  STORE_CONTACT,
} from "@/lib/constants";
import { NewsletterFormLazy } from "@/components/layout/newsletter-form-lazy";
import { InstagramIcon, TikTokIcon } from "@/components/icons/social";

const EXPLORE_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/shop", label: "Collections" },
  { href: "/visit", label: "Come Visit Our Store" },
];

const RESOURCE_LINKS = [
  { href: "/policies/privacy", label: "Privacy Policy" },
  { href: "/policies/shipping", label: "Shipping Policy" },
  { href: "/policies/returns", label: "Refund Policy" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-foreground/8 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4 flex flex-col gap-5">
            <p className="font-serif text-2xl tracking-[0.28em] uppercase">Sandryne</p>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Sandryne Boutique is a fashion-forward, elevated style destination for women, with an
              emphasis on minimalism, elegance, and visual storytelling.
            </p>
            <div className="flex items-center gap-4">
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="hover:opacity-60 transition-opacity"
              >
                <InstagramIcon className="size-5" />
              </a>
              <a
                href={SOCIAL_LINKS.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="hover:opacity-60 transition-opacity"
              >
                <TikTokIcon className="size-5" />
              </a>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <p>
                <a
                  href={`mailto:${SITE_EMAIL}`}
                  className="hover:text-foreground transition-colors"
                >
                  {SITE_EMAIL}
                </a>
              </p>
              {STORE_CONTACT.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>{STORE_CONTACT.hours}</p>
              <p>
                <a
                  href={STORE_CONTACT.phoneHref}
                  className="hover:text-foreground transition-colors"
                >
                  {STORE_CONTACT.phoneDisplay}
                </a>
              </p>
            </div>
          </div>

          <nav aria-label="Explore" className="lg:col-span-2">
            <h3 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
              Explore
            </h3>
            <ul className="flex flex-col gap-2.5">
              {EXPLORE_LINKS.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link href={link.href} className="text-sm hover:opacity-60 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Resources" className="lg:col-span-2">
            <h3 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
              Resources
            </h3>
            <ul className="flex flex-col gap-2.5">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm hover:opacity-60 transition-opacity">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-4">
            <h3 className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
              Stay in touch
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Every piece begins as a whisper, then becomes a statement. Subscribe and be the first
              to discover new arrivals, styling notes, and exclusive moments.
            </p>
            <NewsletterFormLazy />
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-foreground/8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SITE_NAME}
          </p>
          <p className="text-xs text-muted-foreground tracking-[0.18em] uppercase">
            We curate elegance
          </p>
        </div>
      </div>
    </footer>
  );
}
