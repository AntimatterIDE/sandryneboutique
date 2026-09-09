import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Order Confirmed",
};

async function ConfirmationContent({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center flex flex-col items-center gap-6">
      <CheckCircle2 className="size-12" strokeWidth={1} />
      <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">
        Thank you — <em className="italic font-light">your order is confirmed</em>
      </h1>
      <p className="text-muted-foreground leading-relaxed">
        We&apos;ve received your payment and are preparing your pieces with care.
        {order && (
          <>
            {" "}
            Your order reference is{" "}
            <span className="text-foreground font-medium break-all">{order}</span>.
          </>
        )}{" "}
        A confirmation email is on its way to the address you entered at checkout, with your
        receipt, items, and order status. Guest checkouts still get that email. Create an
        account with the same email to track shipping and returns later.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <Button asChild className="rounded-none tracking-[0.2em] uppercase text-xs h-11 px-8">
          <Link href="/shop?category=new-arrivals">Continue Shopping</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-none tracking-[0.2em] uppercase text-xs h-11 px-8">
          <Link href="/account">View My Orders</Link>
        </Button>
      </div>
    </div>
  );
}

export default function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  return (
    <Suspense>
      <ConfirmationContent searchParams={searchParams} />
    </Suspense>
  );
}
