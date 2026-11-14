// Helpers for mobile-money dialing and contacting customers.
export const ussd = (tpl, code, amount) => tpl.split("{code}").join(code).split("{amount}").join(String(amount));
// A "#" must be encoded in tel: links so phones keep it in the dialer.
export const telHref = (u) => "tel:" + u.replace(/#/g, "%23");
export const phoneDigits = (p) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "250" + d.slice(1);
  return d;
};
export const waLink = (p) => "https://wa.me/" + phoneDigits(p);
