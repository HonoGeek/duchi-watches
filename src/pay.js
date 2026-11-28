// Helpers for mobile-money dialing and contacting customers.
export const ussd = (tpl, code, amount) => tpl.split("{code}").join(code).split("{amount}").join(String(amount));
// A "#" must be encoded in tel: links so phones keep it in the dialer.
export const telHref = (u) => "tel:" + u.replace(/#/g, "%23");
export const phoneDigits = (p) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "250" + d.slice(1);
  return d;
};
export const waLink = (p, text) => "https://wa.me/" + phoneDigits(p) + (text ? "?text=" + encodeURIComponent(text) : "");
export const smsLink = (p, text) => "sms:+" + phoneDigits(p) + (text ? "?body=" + encodeURIComponent(text) : "");
// A short, friendly update for the customer, based on where the order is now. Opens ready to send in WhatsApp or SMS.
export const orderMessage = (o, site = {}) => {
  const brand = site.short || "DUCHI", full = site.name || "DUCHI STORE";
  const first = String(o.name || "").trim().split(/\s+/)[0] || "there";
  const link = typeof location !== "undefined" ? `${location.origin}${location.pathname}#/account/orders/${o.id}` : "";
  if (o.status === "Cancelled") return `Hello ${first}, your ${brand} order ${o.id} was cancelled. Please message us if you have any questions.`;
  if (o.status === "Delivered") return `Hello ${first}, your ${brand} order ${o.id} has been delivered. Thank you! You can see your order and leave a review here: ${link}`;
  if (o.status === "Dispatched") return `Hello ${first}, your ${brand} order ${o.id} has been dispatched and is on its way to ${o.district}.`;
  if ((o.payStatus || "Pending") === "Paid") return `Hello ${first}, we received your payment for ${brand} order ${o.id} and we are getting your watch ready.`;
  return `Hello ${first}, this is ${full}. We received your order ${o.id} and we are checking your payment.`;
};
