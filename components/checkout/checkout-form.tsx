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
import { checkoutTotals, isAddressQuotable, isGeorgia } from "@/lib/tax";
import { discountAmount, findDiscount } from "@/lib/discounts";
import { cartLineKey, cartSubtotal, useCart } from "@/lib/store/cart";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { ShippingAddress } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import {
  processCheckout,
  quoteCheckoutShipping,
  type CheckoutShippingOption,
} from "@/app/(store)/checkout/actions";
import { HCaptchaField } from "@/components/checkout/hcaptcha-field";

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

export function CheckoutForm({
  publicKey,
  captchaSiteKey,
  signedInEmail = null,
  signedInName = null,
}: {
  publicKey: string | null;
  captchaSiteKey: string | null;
  signedInEmail?: string | null;
  signedInName?: string | null;
}) {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const hydrated = useHydrated();
  const [shipping, setShipping] = useState<ShippingAddress>(EMPTY_SHIPPING);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billing, setBilling] = useState({
    full_name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
  });
  const [processing, setProcessing] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [shippingRates, setShippingRates] = useState<CheckoutShippingOption[]>([]);
  const [selectedShippingCode, setSelectedShippingCode] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const formMounted = useRef(false);

  // Refs so the token-success handler (bound once) always sees current values.
  const shippingRef = useRef(shipping);
  const billingRef = useRef({ billingSameAsShipping, billing });
  const itemsRef = useRef(items);
  const appliedCodeRef = useRef(appliedCode);
  const captchaTokenRef = useRef(captchaToken);
  const selectedShippingCodeRef = useRef(selectedShippingCode);
  const quotingRef = useRef(quoting);
  const createAccountRef = useRef(createAccount);
  const accountPasswordRef = useRef(accountPassword);
  useEffect(() => {
    shippingRef.current = shipping;
    billingRef.current = { billingSameAsShipping, billing };
    itemsRef.current = items;
    appliedCodeRef.current = appliedCode;
    captchaTokenRef.current = captchaToken;
    selectedShippingCodeRef.current = selectedShippingCode;
    quotingRef.current = quoting;
    createAccountRef.current = createAccount;
    accountPasswordRef.current = accountPassword;
  }, [shipping, billingSameAsShipping, billing, items, appliedCode, captchaToken, selectedShippingCode, quoting, createAccount, accountPassword]);

  useEffect(() => {
    if (!signedInEmail && !signedInName) return;
    setShipping((current) => ({
      ...current,
      email: current.email || signedInEmail || "",
      full_name: current.full_name || signedInName || "",
    }));
  }, [signedInEmail, signedInName]);

  const appliedDiscount = findDiscount(appliedCode);
  const subtotal = cartSubtotal(items);
  const discount = appliedDiscount ? discountAmount(subtotal, appliedDiscount) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const qualifiesFree = discountedSubtotal >= FREE_SHIPPING_THRESHOLD;
  const addressReady = isAddressQuotable(shipping);
  const selectedRate = shippingRates.find((rate) => rate.code === selectedShippingCode) ?? shippingRates[0] ?? null;
  const selectedShippingCost =
    selectedRate == null
      ? null
      : qualifiesFree && (selectedRate.code === "03" || selectedRate.code === "flat")
        ? 0
        : selectedRate.amount;
  const shippingReady = selectedShippingCost != null;
  const { shipping: shippingCost, tax, total } = checkoutTotals({
    subtotal,
    discount,
    state: shipping.state,
    postalCode: shipping.postal_code,
    shippingAmount: selectedShippingCost ?? 0,
  });
  const shipsToGeorgia = isGeorgia(shipping.state, shipping.postal_code);
  const shippingService = selectedRate
    ? selectedShippingCost === 0
      ? `${selectedRate.service} (Free)`
      : selectedRate.service
    : null;

  useEffect(() => {
    if (!addressReady) {
      setShippingRates([]);
      setSelectedShippingCode(null);
      setQuoting(false);
      return;
    }

    let cancelled = false;
    setShippingRates([]);
    setSelectedShippingCode(null);
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      const result = await quoteCheckoutShipping({
        ...shipping,
        phone: shipping.phone || null,
        line2: shipping.line2 || null,
      });
      if (cancelled) return;
      if (result.ok && result.rates.length > 0) {
        setShippingRates(result.rates);
        const ground = result.rates.find((rate) => rate.code === "03");
        const cheapest = result.rates[0];
        setSelectedShippingCode((qualifiesFree && ground ? ground : cheapest).code);
      } else {
        setShippingRates([{ amount: FLAT_SHIPPING_RATE, service: "Standard", code: "flat" }]);
        setSelectedShippingCode("flat");
      }
      setQuoting(false);
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    qualifiesFree,
    addressReady,
    shipping.line1,
    shipping.line2,
    shipping.city,
    shipping.state,
    shipping.postal_code,
    shipping.country,
  ]);

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

      const currentDiscount = findDiscount(appliedCodeRef.current);
      const currentSubtotal = cartSubtotal(currentItems);
      const currentDiscountAmt = currentDiscount ? discountAmount(currentSubtotal, currentDiscount) : 0;
      if (quotingRef.current) {
        toast.error("Hang on — we're calculating shipping for this address.");
        return;
      }
      if (!selectedShippingCodeRef.current) {
        toast.error("Enter a complete shipping address and choose a shipping option before payment.");
        return;
      }
      if (!signedInEmail && createAccountRef.current && accountPasswordRef.current.length < 8) {
        toast.error("Password must be at least 8 characters to create an account.");
        return;
      }
      if (!billingRef.current.billingSameAsShipping) {
        const card = billingRef.current.billing;
        if (!card.line1.trim() || !card.city.trim() || !card.state.trim() || !card.postal_code.trim()) {
          toast.error("Enter the full billing address on the card, or check that it matches shipping.");
          return;
        }
      }

      setProcessing(true);
      try {
        const billing = billingRef.current;
        const result = await processCheckout({
          token,
          shipping: {
            ...currentShipping,
            phone: currentShipping.phone || null,
            line2: currentShipping.line2 || null,
          },
          billing: billing.billingSameAsShipping
            ? null
            : {
                full_name: billing.billing.full_name || currentShipping.full_name,
                line1: billing.billing.line1,
                line2: billing.billing.line2 || null,
                city: billing.billing.city,
                state: billing.billing.state,
                postal_code: billing.billing.postal_code,
                country: billing.billing.country || currentShipping.country,
              },
          lines: currentItems.map((i) => ({
            productId: i.productId,
            variantId: i.variantId ?? null,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
          })),
          discountCode: appliedCodeRef.current,
          captchaToken: captchaTokenRef.current,
          shippingServiceCode: selectedShippingCodeRef.current,
          createAccount: !signedInEmail && createAccountRef.current,
          password: createAccountRef.current ? accountPasswordRef.current : undefined,
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
    [clearCart, router, signedInEmail]
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
                <p className="text-xs text-muted-foreground">
                  Your receipt and shipping updates are sent here
                  {signedInEmail ? `, as ${signedInEmail}.` : "."}
                </p>
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

          {!signedInEmail && (
            <section>
              <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-5">
                Account
              </h2>
              <div className="space-y-3">
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="checkout-account"
                    checked={!createAccount}
                    onChange={() => setCreateAccount(false)}
                    className="mt-1 size-4 accent-foreground"
                  />
                  <span>
                    <span className="font-medium">Checkout as guest</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      We&apos;ll email your receipt. You can create an account later with the same
                      email to see this order.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="checkout-account"
                    checked={createAccount}
                    onChange={() => setCreateAccount(true)}
                    className="mt-1 size-4 accent-foreground"
                  />
                  <span>
                    <span className="font-medium">Create an account</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Track shipping, view past orders, and request returns from your profile.
                    </span>
                  </span>
                </label>
                {createAccount && (
                  <div className="space-y-1.5 sm:max-w-sm">
                    <Label htmlFor="account_password">Password</Label>
                    <Input
                      id="account_password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      className="rounded-none"
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-5">
              Shipping method
            </h2>
            {!addressReady ? (
              <p className="text-sm text-muted-foreground">
                Enter your shipping address to see UPS options and prices.
              </p>
            ) : quoting ? (
              <p className="text-sm text-muted-foreground">Calculating UPS rates…</p>
            ) : (
              <div className="space-y-2">
                {shippingRates.map((rate) => {
                  const price =
                    qualifiesFree && (rate.code === "03" || rate.code === "flat") ? 0 : rate.amount;
                  return (
                    <label
                      key={rate.code}
                      className="flex items-center justify-between gap-4 border border-foreground/15 px-4 py-3 text-sm cursor-pointer has-[:checked]:border-foreground"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <input
                          type="radio"
                          name="shipping-method"
                          value={rate.code}
                          checked={selectedShippingCode === rate.code}
                          onChange={() => setSelectedShippingCode(rate.code)}
                          className="size-4 accent-foreground"
                        />
                        <span className="truncate">{rate.service}</span>
                      </span>
                      <span className="tabular-nums shrink-0">
                        {price === 0 ? "Free" : formatPrice(price)}
                      </span>
                    </label>
                  );
                })}
                {qualifiesFree ? (
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    Orders over {formatPrice(FREE_SHIPPING_THRESHOLD)} include free UPS Ground.
                    Faster options are available at the quoted rate.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-5">
              Billing
            </h2>
            <label className="flex items-start gap-3 text-sm leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={billingSameAsShipping}
                onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                className="mt-1 size-4 accent-foreground"
              />
              <span>Billing address is the same as shipping</span>
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Heartland verifies the ZIP and street on file with the card. If the package ships
              somewhere else, uncheck this and enter the card statement address.
            </p>
            {!billingSameAsShipping && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="billing_name">Name on card</Label>
                  <Input
                    id="billing_name"
                    autoComplete="cc-name"
                    value={billing.full_name}
                    onChange={(e) => setBilling((b) => ({ ...b, full_name: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="billing_line1">Billing street</Label>
                  <Input
                    id="billing_line1"
                    autoComplete="billing address-line1"
                    value={billing.line1}
                    onChange={(e) => setBilling((b) => ({ ...b, line1: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="billing_line2">Apartment, suite, etc. (optional)</Label>
                  <Input
                    id="billing_line2"
                    autoComplete="billing address-line2"
                    value={billing.line2}
                    onChange={(e) => setBilling((b) => ({ ...b, line2: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    autoComplete="billing address-level2"
                    value={billing.city}
                    onChange={(e) => setBilling((b) => ({ ...b, city: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="billing_state">State</Label>
                  <Input
                    id="billing_state"
                    autoComplete="billing address-level1"
                    value={billing.state}
                    onChange={(e) => setBilling((b) => ({ ...b, state: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="billing_postal">Billing ZIP</Label>
                  <Input
                    id="billing_postal"
                    autoComplete="billing postal-code"
                    value={billing.postal_code}
                    onChange={(e) => setBilling((b) => ({ ...b, postal_code: e.target.value }))}
                    className="rounded-none"
                  />
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-5 flex items-center gap-2">
              <Lock className="size-3.5" />
              Payment
            </h2>

            <TrustBadges className="mb-5" />

            {captchaSiteKey ? (
              <div className="mb-5">
                <HCaptchaField siteKey={captchaSiteKey} onToken={setCaptchaToken} />
              </div>
            ) : null}

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
                    {item.finalSale ? (
                      <p className="mt-1 text-[11px] tracking-[0.12em] uppercase text-destructive">
                        Final sale — no returns
                      </p>
                    ) : null}
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
                <dt className="text-muted-foreground">
                  Shipping
                  {shippingService && shippingService !== "Free" && shippingReady && !quoting ? (
                    <span className="block text-[11px]">{shippingService}</span>
                  ) : null}
                </dt>
                <dd className="tabular-nums text-right">
                  {quoting
                    ? "Calculating…"
                    : !addressReady && !qualifiesFree
                      ? "Enter address"
                      : shippingCost === 0
                        ? "Free"
                        : formatPrice(shippingCost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {shippingReady && !quoting && !shipsToGeorgia ? "Tax" : "Georgia tax"}
                </dt>
                <dd className="tabular-nums">
                  {quoting
                    ? "Calculating…"
                    : !shippingReady
                      ? "Enter shipping address"
                      : shipsToGeorgia
                        ? formatPrice(tax)
                        : "None"}
                </dd>
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-base">
                <dt className="tracking-[0.14em] uppercase text-xs self-center">Total</dt>
                <dd className="tabular-nums font-medium">
                  {quoting || !shippingReady ? "—" : formatPrice(total)}
                </dd>
              </div>
            </dl>

            {items.some((item) => item.finalSale) ? (
              <p className="mt-6 text-[11px] text-destructive leading-relaxed">
                Sale items are final sale and cannot be returned or exchanged. See our{" "}
                <Link href="/policies/returns" className="underline underline-offset-2">
                  return policy
                </Link>
                .
              </p>
            ) : null}

            <p className={`${items.some((item) => item.finalSale) ? "mt-3" : "mt-6"} text-[11px] text-muted-foreground leading-relaxed`}>
              Georgia shipping addresses include sales tax. Other states do not. Shipping is
              quoted from your address. Orders over {formatPrice(FREE_SHIPPING_THRESHOLD)} include
              free Ground. By placing your order you agree to our{" "}
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
