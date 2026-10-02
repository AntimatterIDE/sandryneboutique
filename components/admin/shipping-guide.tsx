import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SALES_ORDERS_URL = "https://sandryneboutique.retail.heartland.us/#sales/orders";
const UPS_DROPOFF_URL = "https://www.ups.com/dropoff?loc=en_US";
const UPS_TRACK_URL = "https://www.ups.com/track?loc=en_US";
const FEDEX_LOCATIONS_URL = "https://local.fedex.com/en/search";
const FEDEX_TRACK_URL = "https://www.fedex.com/fedextrack/";
const FEDEX_SHIP_MANAGER_URL = "https://www.fedex.com/en-us/shipping/ship-manager.html";
const FEDEX_DEVELOPER_URL = "https://developer.fedex.com/";
const FEDEX_SHIP_API_URL = "https://developer.fedex.com/api/en-us/catalog/ship/v1/docs.html";

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
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">How to ship</p>
          <h2 className="font-serif text-2xl tracking-tight mt-1">Print the carrier the customer already paid for</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">
            Each order is either UPS or FedEx. The Shipping line on the order names the exact service. Print that one.
            Do not create a second label on UPS.com or FedEx.com, and do not switch carriers.
          </p>
        </div>

        <ol className="space-y-3 text-sm leading-relaxed">
          <li>
            <span className="font-medium">1. Open the paid order on this page.</span> Status{" "}
            <span className="font-medium">Paid</span> is ready to ship.{" "}
            <span className="font-medium">Shipped</span> already has a label or a tracking number.
          </li>
          <li>
            <span className="font-medium">2. Read the Shipping line before you click anything.</span> It will say a
            real service, for example UPS Ground, UPS 2nd Day Air, UPS Next Day Air, FedEx Ground, FedEx Home
            Delivery, FedEx 2Day, FedEx Standard Overnight, or FedEx Priority Overnight. The dollar amount is what the
            customer already paid. Printing the label bills the boutique’s UPS or FedEx account. That is expected. Do
            not charge the customer again.
          </li>
          <li>
            <span className="font-medium">3. Click Print [service] label.</span> UPS opens a 4×6 image in a new tab.
            FedEx opens a 4×6 PDF. If the tab is blank, allow pop-ups for this site and click the button again — it
            reprints the same label, it does not buy another one. Tape it flat on the package. The return address is
            already on the label: Sandryne Boutique, 415 Peachtree Parkway, Ste 235, Cumming, GA 30041.
          </li>
          <li>
            <span className="font-medium">4. Drop it off at the matching carrier</span>, using the steps below. Tracking
            is saved on the order and the customer is emailed. You do not type the tracking number unless the print
            button fails.
          </li>
        </ol>
      </div>

      <Accordion type="multiple" defaultValue={["ups", "fedex", "heartland", "wrong-carrier"]} className="border-t border-foreground/10">
        <AccordionItem value="ups" className="px-4 sm:px-5">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            UPS — where to go and what to look for
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>Use this only when the service name starts with UPS.</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Open <Ext href={UPS_DROPOFF_URL}>UPS Drop-off locator</Ext> and search 30041, or “415 Peachtree Parkway, Cumming, GA”.
              </li>
              <li>
                Choose a UPS Store, a UPS Customer Center, or a drop box that accepts prepaid labels. The result page
                shows the address, today’s hours, and the latest drop-off time.
              </li>
              <li>
                Hand the package to the counter, or put it in that drop box. Do not pay. The label is billed to the
                boutique UPS account.
              </li>
              <li>
                To check it later, open <Ext href={UPS_TRACK_URL}>UPS tracking</Ext> and paste the tracking number from
                this order. It starts with 1Z.
              </li>
            </ol>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fedex" className="px-4 sm:px-5">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            FedEx — where to go and what to look for
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>Use this only when the service name starts with FedEx.</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Open <Ext href={FEDEX_LOCATIONS_URL}>FedEx location search</Ext> and search Cumming, GA 30041.
              </li>
              <li>
                Choose FedEx Office or another staffed FedEx location. Ground and Home Delivery can also go in a FedEx
                drop box that lists those services. Overnight (Standard Overnight, Priority Overnight, First Overnight)
                has to be dropped at a staffed counter before the cutoff time printed on that location’s page.
              </li>
              <li>Do not pay at the counter. The label is billed to the boutique FedEx account.</li>
              <li>
                Track it at <Ext href={FEDEX_TRACK_URL}>FedEx tracking</Ext>. FedEx tracking numbers are 12 to 22 digits.
              </li>
            </ol>
            <p>
              The website already calls FedEx’s Ship API to create the label. Checkout prices use a separate Rates API.
              If the button says FedEx and then shows an error, FedEx has not turned on label printing for the account
              yet. Sign in at <Ext href={FEDEX_DEVELOPER_URL}>developer.fedex.com</Ext>, open the project, and confirm
              both <span className="text-foreground">Rates and Transit Times</span> and{" "}
              <Ext href={FEDEX_SHIP_API_URL}>Ship</Ext> are added. Production labels also need FedEx label certification:
              email label@fedex.com and ask them to certify the production Ship API key for Sandryne Boutique. Until that
              is approved, create the same FedEx service in{" "}
              <Ext href={FEDEX_SHIP_MANAGER_URL}>FedEx Ship Manager</Ext>, then paste the tracking number here and type
              FedEx in the carrier box. Do not substitute a UPS label.
            </p>
            <p>
              On this admin site, <Ext href="/admin/integrations">Integrations</Ext> shows whether the UPS and FedEx
              keys are present and whether FedEx accepted a Ship API login. Secrets are not shown.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="wrong-carrier" className="px-4 sm:px-5">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            If the label or button says UPS but the customer chose FedEx
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              Orders placed before October 2, 2026 did not store the carrier. The print button used to assume UPS
              Ground, so a FedEx checkout could still produce a UPS label. Those orders no longer show a print button.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Open the order confirmation email. A copy also went to tania.manley@sandryneboutique.com. The shipping
                line names UPS or FedEx and the service.
              </li>
              <li>If it says FedEx, do not buy a UPS label.</li>
              <li>
                Buy that FedEx service in <Ext href={FEDEX_SHIP_MANAGER_URL}>FedEx Ship Manager</Ext> for the address on
                this order. Ship from 415 Peachtree Parkway, Ste 235, Cumming, GA 30041.
              </li>
              <li>
                Back on this order, type <span className="text-foreground">FedEx</span> in the carrier box, paste the
                tracking number, and click Save tracking &amp; mark shipped. The customer email uses the carrier you
                type.
              </li>
            </ol>
            <p>New orders save the service. The button name matches the email, and a FedEx order cannot print a UPS label.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="heartland" className="px-4 sm:px-5">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Where the order is in Heartland — and where it is not
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
            <p>
              Website orders are not on the in-store register. Searching the last 4 digits of the card on the POS only
              finds cards that were swiped in the store. The website charge is a separate ecommerce transaction.
            </p>
            <p>
              The sale itself is a Sales Order. Open{" "}
              <Ext href={SALES_ORDERS_URL}>Heartland Sales Orders</Ext>. The page title must say Sales Orders, and the
              address must end in <span className="font-mono text-foreground">#sales/orders</span>.
            </p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                Set both filters to <span className="text-foreground">Any Status</span> and{" "}
                <span className="text-foreground">All Location</span>. Open or Complete alone can hide a website order.
              </li>
              <li>Find the customer name in the Customer column.</li>
              <li>
                The number in the # column has to match <span className="text-foreground">Retail Sales Order</span> on
                this admin order. Example: 100013 on both screens is the same order.
              </li>
              <li>
                <span className="text-foreground">Pending</span> with{" "}
                <span className="text-foreground">Invoiced Qty 0</span> still means the order is there. The card was
                already charged on the website. Pending means Heartland has not invoiced it yet.
              </li>
              <li>Canceled rows are old test orders. They are not missing new sales.</li>
              <li>
                If Retail Sales Order on this page is a dash, Heartland never received it. Open the order and click{" "}
                <span className="text-foreground">Send to Heartland</span>. That does not charge the card again. Refresh
                the Sales Orders page and look for the new number at the top.
              </li>
            </ol>
            <p>
              To see the card charge, use Global Payments Merchant Center and search the Gateway Txn ID shown on the
              order (or an invoice that starts with W plus the last 4). That number will not match a swiped store ticket.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
