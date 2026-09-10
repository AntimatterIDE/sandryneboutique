import "server-only";
import { Resend } from "resend";
import { publicSiteUrl } from "@/lib/site-url";
import { SITE_EMAIL, SITE_NAME, STORE_CONTACT } from "@/lib/constants";
import type { Order } from "@/lib/types";
import { formatPrice, orderMoneyBreakdown, orderRefundBreakdown } from "@/lib/types";

function siteUrl(): string {
  return publicSiteUrl();
}

function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || `${SITE_NAME} <${SITE_EMAIL}>`;
}

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function orderStatusLabel(order: Order): string {
  if (order.refunded_at || order.status === "returned") return "Refunded";
  if (order.return_requested_at && !order.return_received_at) return "Return requested";
  if (order.return_received_at && !order.refunded_at) return "Return received — refund pending";
  if (order.status === "shipped") return "Shipped";
  if (order.status === "paid") return "Paid — preparing to ship";
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "pending") return "Pending";
  return order.status;
}

function trackingUrl(order: Order): string | null {
  const tracking = order.tracking_number?.trim();
  if (!tracking) return null;
  return `https://www.ups.com/track?tracknum=${encodeURIComponent(tracking)}`;
}

function itemRows(order: Order): string {
  return order.items
    .map((item) => {
      const opts = [item.size, item.color].filter(Boolean).join(" · ");
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">
          ${escapeHtml(String(item.quantity))} × ${escapeHtml(item.name)}${
            opts ? ` <span style="color:#666;">(${escapeHtml(opts)})</span>` : ""
          }${
            item.final_sale
              ? ` <span style="color:#8a1f1f;font-size:12px;">Final sale — no returns</span>`
              : ""
          }
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.price * item.quantity)}</td>
      </tr>`;
    })
    .join("");
}

function moneyRows(order: Order): string {
  const money = orderMoneyBreakdown(order);
  return `
    <tr><td style="padding:8px 0;color:#666;">Shipping${order.shipping_service ? ` · ${escapeHtml(order.shipping_service)}` : ""}</td><td style="padding:8px 0;text-align:right;">${money.shipping === 0 ? "Free" : formatPrice(money.shipping)}</td></tr>
    <tr><td style="padding:8px 0;color:#666;">Tax</td><td style="padding:8px 0;text-align:right;">${formatPrice(money.tax)}</td></tr>
    <tr><td style="padding:12px 0 0;font-weight:600;border-top:1px solid #111;">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:600;border-top:1px solid #111;">${formatPrice(money.total)}</td></tr>
  `;
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f6f4f1;font-family:Georgia,serif;color:#111;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <p style="letter-spacing:0.28em;text-transform:uppercase;font-size:11px;font-family:system-ui,sans-serif;">${escapeHtml(SITE_NAME)}</p>
    <h1 style="font-size:28px;font-weight:400;margin:12px 0 24px;">${title}</h1>
    <div style="background:#fff;padding:28px;line-height:1.55;font-size:15px;">
      ${body}
    </div>
    <p style="margin-top:24px;font-size:12px;color:#666;font-family:system-ui,sans-serif;">
      ${escapeHtml(STORE_CONTACT.addressLines.join(", "))}<br/>
      ${escapeHtml(SITE_EMAIL)} · ${escapeHtml(STORE_CONTACT.phoneDisplay)}
    </p>
  </div>
</body></html>`;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = resendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY is not set — skipping email:", subject);
    return;
  }
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject,
    html,
  });
  if (error) {
    console.error("Resend send failed:", error);
  }
}

export async function sendOrderConfirmation(order: Order): Promise<void> {
  const money = orderMoneyBreakdown(order);
  const accountUrl = `${siteUrl()}/account`;
  const html = layout(
    "Your order is confirmed",
    `
      <p>Thank you, ${escapeHtml(order.shipping_address.full_name)}. We received your payment and are preparing your order.</p>
      <p style="font-size:13px;color:#666;font-family:system-ui,sans-serif;">Order status: <strong>${escapeHtml(orderStatusLabel(order))}</strong><br/>Reference ${escapeHtml(order.id)}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">${itemRows(order)}${moneyRows(order)}</table>
      <p style="margin-top:20px;font-size:13px;color:#666;">Ship to:<br/>
        ${escapeHtml(order.shipping_address.line1)}<br/>
        ${order.shipping_address.line2 ? `${escapeHtml(order.shipping_address.line2)}<br/>` : ""}
        ${escapeHtml(order.shipping_address.city)}, ${escapeHtml(order.shipping_address.state)} ${escapeHtml(order.shipping_address.postal_code)}
      </p>
      <p style="margin-top:20px;font-size:13px;">A receipt is included above. Track this order anytime in <a href="${accountUrl}">your account</a>.</p>
      ${
        money.shipping > 0
          ? `<p style="font-size:12px;color:#666;">Original shipping (${formatPrice(money.shipping)}) is not refunded if you return the order. Return shipping is also paid by you.</p>`
          : ""
      }
    `
  );
  await send(order.email, `Order confirmed · ${SITE_NAME}`, html);
}

export async function sendShippingNotification(order: Order): Promise<void> {
  const track = trackingUrl(order);
  const html = layout(
    "Your order has shipped",
    `
      <p>Good news — your Sandryne order is on its way.</p>
      <p style="font-size:13px;color:#666;font-family:system-ui,sans-serif;">
        ${order.tracking_carrier ? escapeHtml(order.tracking_carrier) : "UPS"}
        ${order.tracking_number ? ` · ${escapeHtml(order.tracking_number)}` : ""}
      </p>
      ${track ? `<p><a href="${track}">Track your package</a></p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">${itemRows(order)}</table>
      <p style="margin-top:20px;font-size:13px;"><a href="${siteUrl()}/account">View order status</a></p>
    `
  );
  await send(order.email, `Your order has shipped · ${SITE_NAME}`, html);
}

export async function sendReturnRequestedEmails(order: Order): Promise<void> {
  const money = orderRefundBreakdown(order);
  const address = STORE_CONTACT.addressLines.map(escapeHtml).join("<br/>");
  const customerHtml = layout(
    "Return requested",
    `
      <p>We received your return request for order ${escapeHtml(order.id.slice(0, 8))}.</p>
      <p>Please ship the unworn item(s) with tags attached via UPS or FedEx (not USPS) to:</p>
      <p>${address}</p>
      <p>Write your order reference on the label. <strong>You pay return shipping</strong>. Original shipping${money.shippingKept > 0 ? ` (${formatPrice(money.shippingKept)})` : ""} is not refunded.</p>
      <p>Once we receive the package, we will refund ${formatPrice(money.refundable)} to your original card.</p>
    `
  );
  await send(order.email, `Return requested · ${SITE_NAME}`, customerHtml);
  await send(
    SITE_EMAIL,
    `Return requested · ${order.email}`,
    layout(
      "Customer return request",
      `<p>${escapeHtml(order.shipping_address.full_name)} (${escapeHtml(order.email)}) requested a return.</p>
       <p>Order ${escapeHtml(order.id)}</p>
       <p>Refund due after the item arrives: ${formatPrice(money.refundable)}. Keep shipping ${formatPrice(money.shippingKept)}.</p>
       <p><a href="${siteUrl()}/admin/orders">Open admin orders</a></p>`
    )
  );
}

export async function sendRefundIssued(order: Order): Promise<void> {
  const amount = Number(order.refunded_amount ?? 0);
  const money = orderRefundBreakdown({ ...order, refunded_amount: 0 });
  const html = layout(
    "Your refund is on the way",
    `
      <p>We received your return and issued a refund of ${formatPrice(amount)} to the original card.</p>
      ${
        money.shippingKept > 0
          ? `<p>Original shipping of ${formatPrice(money.shippingKept)} was not refunded, as noted at checkout.</p>`
          : ""
      }
      <p style="font-size:13px;color:#666;">Reference ${escapeHtml(order.id)}</p>
    `
  );
  await send(order.email, `Refund issued · ${SITE_NAME}`, html);
}

export async function sendWelcomeEmail(input: {
  email: string;
  fullName: string;
}): Promise<void> {
  const html = layout(
    "Your account is ready",
    `
      <p>Hi ${escapeHtml(input.fullName.split(" ")[0] || "there")},</p>
      <p>Your Sandryne Boutique account is set up. Sign in anytime to track orders, shipping, and returns.</p>
      <p><a href="${siteUrl()}/login">Sign in to your account</a></p>
    `
  );
  await send(input.email, `Your account · ${SITE_NAME}`, html);
}

export { orderStatusLabel };
