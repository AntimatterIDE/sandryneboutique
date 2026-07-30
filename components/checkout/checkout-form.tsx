"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrustBadges } from "@/components/product/trust-badges";
import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { discountAmount, findDiscount } from "@/lib/discounts";
import { cartLineKey, cartSubtotal, useCart } from "@/lib/store/cart";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { ShippingAddress } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { processCheckout } from "@/app/(store)/checkout/actions";

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

const EMPTY_SHIPPING: ShippingAddress = {
  full_name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "United States",
};

export function CheckoutForm({ publicKey }: { publicKey: string | null }) {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const hydrated = useHydrated();
  const [shipping, setShipping] = useState<ShippingAddress>(EMPTY_SHIPPING);
  const [processing, setProcessing] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const formMounted = useRef(false);

  // Refs so the token-success handler (bound once) always sees current values.
  const shippingRef = useRef(shipping);
  const itemsRef = useRef(items);
  const appliedCodeRef = useRef(appliedCode);
  useEffect(() => {
    shippingRef.current = shipping;
    itemsRef.current = items;
    appliedCodeRef.current = appliedCode;
  }, [shipping, items, appliedCode]);

  const appliedDiscount = findDiscount(appliedCode);
  const subtotal = cartSubtotal(items);
  const discount = appliedDiscount ? discountAmount(subtotal, appliedDiscount) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const shippingCost =
    subtotal === 0
      ? 0
      : discountedSubtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : FLAT_SHIPPING_RATE;
  const total = discountedSubtotal + shippingCost;

  const applyDiscount = () => {
    const def = findDiscount(discountInput);
    if (!def) {
      toast.error("That discount code isn't valid.");
      return;
    }
    setAppliedCode(def.code);
    toast.success(`${def.code} applied — ${def.description}.`);
  };

  const submitOrder = useCallback(
    async (token: string) => {
      const currentShipping = shippingRef.current;
      const currentItems = itemsRef.current;

      setProcessing(true);
      try {
        const result = await processCheckout({
          token,
          shipping: {
            ...currentShipping,
            phone: currentShipping.phone || null,
            line2: currentShipping.line2 || null,
          },
          lines: currentItems.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? null,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
          })),
          discountCode: appliedCodeRef.current,
        });

        if (result.ok) {
          clearCart();
          router.push(`/checkout/confirmation?order=${result.orderId}`);
        } else {
          toast.error(result.error);
          setProcessing(false);
        }
      } catch (err) {
        console.error("Checkout failed:", err);
        toast.error("Something went wrong. Please try again.");
        setProcessing(false);
      }
    },
    [clearCart, router]
  );

  useEffect(() => {
    if (!scriptReady || !publicKey || formMounted.current || !window.GlobalPayments) return;
    formMounted.current = true;

    window.GlobalPayments.configure({ publicApiKey: publicKey });
    const cardForm = window.GlobalPayments.creditCard.form("#heartland-card", {
      style: "default",
    });

    cardForm.on("token-success", (resp) => {
      submitOrder(resp.paymentReference);
    });

    cardForm.on("token-error", (resp) => {
      const message =
        resp.reasons?.[0]?.message ??
        resp.error?.message ??
        "Please check your card details and try again.";
      toast.error(message);
    });
  }, [scriptReady, publicKey, submitOrder]);

  const update = (field: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setShipping((s) => ({ ...s, [field]: e.target.value }));

  if (hydrated && items.length === 0 && !processing) {
    return (
      <div className="py-24 text-center">
        <p className="font-serif text-3xl mb-4">Your cart is empty</p>
        <Button asChild variant="outline" className="rounded-none tracking-[0.18em] uppercase text-xs">
          <Link href="/shop?category=new-arrivals">Explore New Arrivals</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {publicKey && (
        <Script
          src="https://js.globalpay.com/4.1.26/globalpayments.js"
          onLoad={() => setScriptReady(true)}
        />
      )}

      <div className="grid gap-12 lg:grid-cols-12">
        {/* Left: shipping + payment */}
        <div className="lg:col-span-7 space-y-10">
          <section>
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-5">
              Contact &amp; Shipping
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" autoComplete="name" value={shipping.full_name} onChange={update("full_name")} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={shipping.email} onChange={update("email")} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" autoComplete="tel" value={shipping.phone ?? ""} onChange={update("phone")} className="rounded-none" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="line1">Street address</Label>
                <Input id="line1" autoComplete="address-line1" value={shipping.line1} onChange={update("line1")} className="rounded-none" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="line2">Apartment, suite, etc. (optional)</Label>
                <Input id="line2" autoComplete="address-line2" value={shipping.line2 ?? ""} onChange={update("line2")} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" autoComplete="address-level2" value={shipping.city} onChange={update("city")} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input id="state" autoComplete="address-level1" value={shipping.state} onChange={update("state")} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postal_code">Postal code</Label>
                <Input id="postal_code" autoComplete="postal-code" value={shipping.postal_code} onChange={update("postal_code")} className="rounded-none" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input id="country" autoComplete="country-name" value={shipping.country} onChange={update("country")} className="rounded-none" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-5 flex items-center gap-2">
              <Lock className="size-3.5" />
              Payment
            </h2>

            <TrustBadges className="mb-5" />

            {publicKey ? (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  Card details are captured securely by Heartland — they never touch our
                  servers. Complete the card form below to place your order.
                </p>
                {/* Heartland hosted fields render into this container */}
                <div id="heartland-card" className="min-h-28" />
                {!scriptReady && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading secure payment form…
                  </div>
                )}
              </>
            ) : (
              <div className="border border-foreground/15 bg-secondary/50 p-5 text-sm text-muted-foreground leading-relaxed">
                Payments are not configured yet. Add{" "}
                <code className="text-xs">NEXT_PUBLIC_HEARTLAND_PUBLIC_KEY</code> and{" "}
                <code className="text-xs">HEARTLAND_SECRET_KEY</code> to your environment to
                enable the secure Heartland card form.
              </div>
            )}

            {processing && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Processing your payment…
              </div>
            )}
          </section>
        </div>

        {/* Right: order summary */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-36 border border-foreground/10 p-6 sm:p-8">
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-6">
              Order Summary
            </h2>

            <div className="divide-y divide-foreground/8">
              {items.map((item) => (
                <div key={cartLineKey(item)} className="flex gap-4 py-4">
                  <div className="relative w-16 h-20 shrink-0 overflow-hidden bg-muted">
                    {item.image && (
                      <Image src={item.image} alt={item.name} fill sizes="64px" className="object-cover" />
                    )}
                    <span className="absolute -top-0 -right-0 bg-foreground text-background text-[10px] size-5 flex items-center justify-center tabular-nums">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-2">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[item.size, item.color].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <Separator className="my-5" />

            {appliedDiscount ? (
              <div className="mb-5 flex items-center justify-between border border-foreground/15 bg-secondary/50 px-3 py-2.5">
                <span className="text-xs">
                  <span className="font-mono font-medium">{appliedDiscount.code}</span>
                  {" — "}
                  {appliedDiscount.description}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCode(null);
                    setDiscountInput("");
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="mb-5 flex gap-2">
                <Input
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyDiscount();
                    }
                  }}
                  placeholder="Discount code"
                  aria-label="Discount code"
                  className="rounded-none uppercase placeholder:normal-case"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyDiscount}
                  disabled={!discountInput.trim()}
                  className="rounded-none tracking-[0.14em] uppercase text-xs"
                >
                  Apply
                </Button>
              </div>
            )}

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
              </div>
              {discount > 0 && appliedDiscount && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Discount ({appliedDiscount.code})
                  </dt>
                  <dd className="tabular-nums text-destructive">
                    −{formatPrice(discount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="tabular-nums">
                  {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
                </dd>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-base">
                <dt className="tracking-[0.14em] uppercase text-xs self-center">Total</dt>
                <dd className="tabular-nums font-medium">{formatPrice(total)}</dd>
              </div>
            </dl>

            <p className="mt-6 text-[11px] text-muted-foreground leading-relaxed">
              Orders over {formatPrice(FREE_SHIPPING_THRESHOLD)} ship free. By placing your
              order you agree to our{" "}
              <Link href="/policies/terms" className="underline underline-offset-2">
                terms of service
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
