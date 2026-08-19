import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  const publicKey = process.env.NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY || null;
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16">
      <header className="mb-10">
        <p className="text-[11px] tracking-[0.24em] uppercase text-muted-foreground mb-3">
          Sandryne Boutique
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Checkout</h1>
      </header>

      <CheckoutForm publicKey={publicKey} captchaSiteKey={captchaSiteKey} />
    </div>
  );
}
