import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FEDEX_ACCOUNT_URL,
  UPS_CREATE_LABEL_URL,
  UPS_SHIPMENT_HISTORY_URL,
} from "@/lib/shipping-services";

const SALES_ORDERS_URL = "https://sandryneboutique.retail.heartland.us/#sales/orders";
const UPS_DROPOFF_URL = "https://www.ups.com/dropoff?loc=en_US";
const FEDEX_LOCATIONS_URL = "https://local.fedex.com/en/search";

function Ext({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}

export function ShippingGuide() {
  return (
    <section id="how-to-ship" className="border border-foreground/15 bg-muted/20">
      <div className="px-4 py-4 sm:px-5 sm:py-5 space-y-4">
        <div>
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">How to print a label</p>
          <h2 className="font-serif text-2xl tracking-tight mt-1">Open the order. Click the carrier. Log in.</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            The print button on each order opens UPS or FedEx. You log in with the boutique account. The website orders are not already sitting in that list.
          </p>
        </div>

        <ol className="space-y-3 text-sm leading-relaxed">
          <li>
            <span className="font-medium">1. Open the paid order on this page.</span>
          </li>
          <li>
            <span className="font-medium">2. Click the big button.</span> It says Open UPS or Open FedEx. A new tab opens. Log in.
          </li>
          <li>
            <span className="font-medium">3. Look at the box under the button.</span> If it shows a tracking number, paste that number into the shipment list and print that label. If it says there is no number yet, do not search. Start a new shipment and paste the address.
          </li>
        </ol>

        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="border border-foreground/15 p-3 space-y-2">
            <p className="font-medium">UPS</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Already have a tracking number? Open{" "}
              <Ext href={UPS_SHIPMENT_HISTORY_URL}>UPS Shipping History</Ext>. Log in. Paste the number. It starts with 1Z. Print that label.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No tracking number yet? Open <Ext href={UPS_CREATE_LABEL_URL}>UPS Create a Shipment</Ext>. Log in. Do not search. Make a new label and paste the address from the order.
            </p>
          </div>
          <div className="border border-foreground/15 p-3 space-y-2">
            <p className="font-medium">FedEx</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open <Ext href={FEDEX_ACCOUNT_URL}>FedEx Ship Manager</Ext>. Log in with the boutique FedEx account.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Already have a tracking number? Click Ship History. Paste the number. Print that label.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No tracking number yet? Click Create a Shipment. Do not search. Paste the address from the order.
            </p>
          </div>
        </div>

        <div className="border border-foreground/15 p-3 text-sm space-y-2">
          <p className="font-medium">Which number do I type?</p>
          <p className="text-muted-foreground leading-relaxed">
            Only the tracking number on that order. That is the number UPS or FedEx made when the label was created.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Do not type the Heartland number, like 100014. Do not type the long order id. Those numbers are not in UPS or FedEx. Searching them will look like the order is missing.
          </p>
        </div>
      </div>

      <Accordion type="multiple" className="border-t border-foreground/10">
        <AccordionItem value="dropoff" className="px-4 sm:px-5">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            After it prints, where do I take the box?
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              UPS label: take it to a UPS Store or drop box. Find one at <Ext href={UPS_DROPOFF_URL}>UPS drop-off</Ext>. Search 30041. Do not pay. The label is already paid.
            </p>
            <p>
              FedEx label: take it to FedEx Office. Find one at <Ext href={FEDEX_LOCATIONS_URL}>FedEx locations</Ext>. Search Cumming, GA 30041. Do not pay.
            </p>
            <p>Ship from Sandryne Boutique, 415 Peachtree Parkway, Ste 235, Cumming, GA 30041. That address is already the return address when you use the boutique account.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="heartland" className="px-4 sm:px-5">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Heartland is a different list. It does not print the label.
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              Heartland Sales Orders is where the sale is recorded. Open{" "}
              <Ext href={SALES_ORDERS_URL}>Heartland Sales Orders</Ext>. Set the filters to Any Status and All Location. Match the Retail Sales Order number on this page, such as 100014.
            </p>
            <p>That number does not print a UPS or FedEx label. Use the button on this page for the label.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
