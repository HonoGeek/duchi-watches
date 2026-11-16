import { Link } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Newsletter, Reveal, Icon } from "../ui";
import Reviews from "../Reviews";
import HangingRail from "../HangingRail";
import Videos from "../Videos";
import Hero from "../Hero";
import Faq from "../Faq";
import { IM } from "../data";
import { fmt, byNewest } from "../lib";

const MARQUEE = ["Quality checked", "Delivered across Rwanda", "MTN MoMo and Airtel Money", "Gift-ready packaging", "Friendly WhatsApp support"];
const CHECKS = ["Movement and timekeeping checked", "Dial and glass inspected", "Strap and clasp examined", "Overall appearance verified", "Carefully packaged before dispatch"]; // only list checks you actually perform
const DIFF = [
  ["truck", "Delivery Across Rwanda", "Get your favourite timepiece delivered conveniently wherever you are in Rwanda."],
  ["card", "Flexible Payment Options", "Shop with convenient payment methods, including MTN Mobile Money and Airtel Money."],
  ["shield", "Quality Checked", "Every timepiece is inspected before it is carefully prepared for delivery."],
  ["chat", "Friendly Customer Support", "Have a question? Our team is available to help you choose the right timepiece."],
];
// Fallback category blurbs (keyed by category name); c.desc from the store wins if present
const CAT_DESC = {
  "Steel Watches": "Modern, versatile, and effortlessly sophisticated. Perfect for everyday wear and a polished look.",
  "Leather Watches": "Classic elegance meets everyday comfort. Designed for those who appreciate timeless simplicity.",
  "Chronograph Watches": "Precision-inspired design with distinctive details. Made for those who appreciate functionality and bold character.",
};

// Entries with an empty answer are hidden. Fill them in once the policy is confirmed.
const DELIVERY_TIME = ""; // e.g. "Kigali: same or next day. Other districts: 2 to 3 days."
const RETURNS = "";       // returns / exchange policy
const WARRANTY = "";      // warranty terms
const TRACKING = "";      // how customers track an order

export default function Home() {
  const { products, zones, cats } = useStore();
  const live = products.filter((p) => p.active !== false);
  const fresh = [...live].sort(byNewest).slice(0, 6); // New arrivals: the 6 most recently added visible products
  const shownCats = cats.filter((c) => live.some((p) => p.c === c.name)); // empty categories stay hidden
  const p0 = products[0];
  const minFee = zones.length ? Math.min(...zones.map((z) => z.fee)) : 0;
  const zoneText = zones.map((z) => `${z.name} ${fmt(z.fee)}`).join(", ");
  const faq = [
    ["Where does DUCHI deliver?", zoneText ? `We deliver across Rwanda with one flat fee per order: ${zoneText}.` : "We deliver across Rwanda. The delivery fee is shown at checkout."],
    ["What payment methods do you accept?", "MTN Mobile Money, Airtel Money, card or bank transfer."],
    ["How can I place an order?", "Add your watches to the cart and enter your delivery details at checkout. We call you to confirm."],
    ["How long does delivery take?", DELIVERY_TIME],
    ["Can I return or exchange a watch?", RETURNS],
    ["Do your watches come with a warranty?", WARRANTY],
    ["How can I track my order?", TRACKING],
    ["How can I contact customer support?", "Message us on WhatsApp or use the contact page."],
  ]; // <Faq> drops unanswered and repeated questions

  return (
    <>
      <Hero product={p0} minFee={minFee} />

      <div className="mq" aria-hidden="true">
        <div className="mqt">{[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((t, i) => <span key={i}>{t}<i /></span>)}</div>
      </div>

      <section><div className="wrap">
        <Reveal className="head"><div className="sh"><h2 className="h2">Just Arrived</h2><p className="sub">Explore our latest collection of carefully selected timepieces. From modern everyday essentials to sophisticated statement pieces, discover the newest additions to DUCHI.</p></div><Button to="/shop" variant="o" size="s">View all watches</Button></Reveal>
        <Reveal d={90}><HangingRail items={fresh} /></Reveal>
      </div></section>

      {shownCats.length > 0 && (
        <section><div className="wrap">
          <Reveal className="head"><div className="sh"><h2 className="h2">Find Your Style</h2><p className="sub">Every style tells a different story. Explore our collection by design, material, and functionality to find a watch that complements your personality and the way you live.</p></div></Reveal>
          <div className="tiles">
            {shownCats.map((c, i) => (
              <Reveal key={c.name} d={i * 110}>
                <Link className="tile" to={`/shop?cat=${encodeURIComponent(c.name)}`}>
                  <Img id={c.img || live.find((p) => p.c === c.name)?.im[0] || IM[0]} alt={c.name} w={700} />
                  <div><h3 className="h3">{c.name}</h3>{(c.desc || CAT_DESC[c.name]) && <p style={{ opacity: 0.9, fontSize: 14, margin: "6px 0 8px", maxWidth: 320 }}>{c.desc || CAT_DESC[c.name]}</p>}<div style={{ opacity: 0.85, fontSize: 14 }}>{live.filter((p) => p.c === c.name).length} watches</div><span className="go">Shop now</span></div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div></section>
      )}

      <Videos />

      <section><div className="wrap split">
        <Reveal className="maskwrap" style={{ aspectRatio: 1, borderRadius: "var(--r)", overflow: "hidden" }}>
          <Img id={IM[1]} alt="Close view of a watch dial" w={1000} />
          <div className="badge2"><span className="ci">{Icon.shield}</span><div><b style={{ fontWeight: 500 }}>Checked by our team</b><div className="mute sm">Before every dispatch</div></div></div>
        </Reveal>
        <Reveal className="stack" d={150}>
          <h2 className="h2">Quality Comes First.</h2>
          <p className="sub">Every watch deserves attention to detail. Before your order reaches you, we carefully inspect its appearance and condition to ensure it meets our quality expectations.</p>
          <ul className="chk">
            {CHECKS.map((t, i) => <li key={t} style={{ "--k": i }}><span className="ci">{Icon.check}</span>{t}</li>)}
          </ul>
          <div className="row"><Button to="/shop">Discover Our Standards</Button><Button to="/contact" variant="o">Talk to Our Team</Button></div>
        </Reveal>
      </div></section>

      <section className="alt"><div className="wrap split" style={{ alignItems: "start" }}>
        <Reveal className="stack">
          <h2 className="h2">The DUCHI Difference</h2>
          <p className="sub">Buying a watch should feel as special as wearing one. At DUCHI, we focus on making your shopping experience simple, convenient, and dependable, from choosing your timepiece to receiving it at your doorstep.</p>
        </Reveal>
        <Reveal className="bn" d={120}>
          {DIFF.map(([ic, h, p]) => (
            <div className="bi" key={h}>
              <div className="ti">{Icon[ic]}</div>
              <div><h3>{h}</h3><p className="mute">{p}</p></div>
            </div>
          ))}
        </Reveal>
      </div></section>

      <Reviews alt={false} />

      <section className="alt faq-sec"><div className="wrap split">
        <Reveal className="stack faq-intro">
          <h2 className="h2">Everything You Need to Know.</h2>
          <p className="sub">Have questions before making your purchase? We’ve put together answers to help you shop with confidence and understand everything about ordering, payment, and delivery.</p>
          <Button to="/contact" variant="o" size="s">Still have a question? Contact us</Button>
        </Reveal>
        <Reveal d={120}><Faq items={faq} /></Reveal>
      </div></section>

      <Newsletter />
    </>
  );
}
