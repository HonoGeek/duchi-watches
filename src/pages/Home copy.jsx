import { Link } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, ProductCard, Newsletter, Reveal, Icon } from "../ui";
import Reviews from "../Reviews";
import HangingRail from "../HangingRail";
import Videos from "../Videos";
import { IM } from "../data";
import { fmt, byNewest } from "../lib";

const MARQUEE = ["Quality checked", "Delivered across Rwanda", "MTN MoMo and Airtel Money", "Gift-ready packaging", "Friendly WhatsApp support"];
const TRUST = [
  ["truck", "Delivery across Rwanda", "One flat fee per order."],
  ["card", "Flexible payment", "MTN MoMo, Airtel Money, card or bank."],
  ["shield", "Quality checked", "Inspected by our team."],
  ["chat", "Friendly support", "Message us on WhatsApp."],
];
const CHECKS = ["Movement and date tested", "Crown and glass checked", "Strap inspected and cleaned", "Packed in a gift-ready box"];
const WHY = ["Every watch checked before dispatch", "Delivery across Rwanda with clear fees", "Pay with MTN MoMo or Airtel Money", "Gift-ready box with every order", "Real people on WhatsApp"];

export default function Home() {
  const { products, zones, cats } = useStore();
  const live = products.filter((p) => p.active !== false);
  const fresh = [...live].sort(byNewest).slice(0, 6); // New arrivals: the 6 most recently added visible products
  const shownCats = cats.filter((c) => live.some((p) => p.c === c.name)); // empty categories stay hidden
  const p0 = products[0];
  const zoneText = zones.map((z) => `${z.name} ${fmt(z.fee)}`).join(", ");
  const faq = [
    ["How much is delivery?", `One flat fee per order: ${zoneText}.`],
    ["How can I pay?", "MTN Mobile Money, Airtel Money, card or bank transfer."],
    ["How do I order?", "Add your watches to the cart and enter your delivery details at checkout. We call you to confirm."],
    ["How do I reach you?", "Message us on WhatsApp or use the contact page."],
  ];
  return (
    <>
      <div className="hero">
        <Img id={IM[2]} alt="Watch on wrist" w={1800} />
        <div className="wrap">
          <Link className="glass" to="/product/0">
            <div className="gi"><Img id={p0.im[0]} w={120} /></div>
            <div><b>{p0.n}</b><span>{fmt(p0.p)}</span></div>
          </Link>
          <h1 className="h1 hw" style={{ maxWidth: 760 }} aria-label="Time, well kept.">
            {["Time,", "well", "kept."].map((w, i) => (
              <span className="w" key={i} aria-hidden="true"><span className={i ? "shine" : ""} style={{ "--i": i }}>{w}</span></span>
            ))}
          </h1>
          <p className="lead">Watches chosen for design and reliability, checked by our team in Kigali and delivered to your door.</p>
          <div className="row">
            <Button variant="g" to="/shop">Shop the collection</Button>
            <Button variant="w" to="/contact">Talk to us</Button>
          </div>
          <div className="facts">
            <div><b>Delivered across Rwanda</b>From {fmt(Math.min(...zones.map((z) => z.fee)))}</div>
            <div><b>Pay your way</b>MTN MoMo, Airtel Money, card</div>
            <div><b>Checked before dispatch</b>Every watch, every order</div>
          </div>
        </div>
      </div>

      <div className="mq" aria-hidden="true">
        <div className="mqt">{[...MARQUEE, ...MARQUEE, ...MARQUEE, ...MARQUEE].map((t, i) => <span key={i}>{t}<i /></span>)}</div>
      </div>

      <section><div className="wrap">
        <Reveal className="head"><h2 className="h2">New arrivals</h2><Button to="/shop" variant="o" size="s">View all</Button></Reveal>
        <Reveal d={90}><HangingRail items={fresh} /></Reveal>
      </div></section>

      {shownCats.length > 0 && (
        <section><div className="wrap">
          <Reveal className="head"><h2 className="h2">Shop by style</h2></Reveal>
          <div className="tiles">
            {shownCats.map((c, i) => (
              <Reveal key={c.name} d={i * 110}>
                <Link className="tile" to={`/shop?cat=${encodeURIComponent(c.name)}`}>
                  <Img id={c.img || live.find((p) => p.c === c.name)?.im[0] || IM[0]} alt={c.name} w={700} />
                  <div><h3 className="h3">{c.name}</h3><div style={{ opacity: 0.85, fontSize: 14 }}>{live.filter((p) => p.c === c.name).length} watches</div><span className="go">Shop now</span></div>
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
          <h2 className="h2">Inspected before it leaves us.</h2>
          <p className="lead">We test the movement, crown, glass and strap, then pack every watch in a gift-ready box.</p>
          <ul className="chk">
            {CHECKS.map((t, i) => <li key={t} style={{ "--k": i }}><span className="ci">{Icon.check}</span>{t}</li>)}
          </ul>
          <div className="row"><Button to="/shop">Find your watch</Button><Button to="/contact" variant="o">Ask a question</Button></div>
        </Reveal>
      </div></section>

      <section><div className="wrap split" style={{ alignItems: "start" }}>
        <Reveal className="stack">
          <h2 className="h2">Why choose us over others?</h2>
          <p className="lead">Buying a watch online should feel safe. Here is how we make it easy.</p>
          <div className="row"><Button to="/shop" variant="o">Shop the collection</Button></div>
        </Reveal>
        <Reveal className="cmp" d={120}>
          <div className="c3 hd"><span /><span style={{ color: "var(--gold)" }}>DUCHI</span><span>Others</span></div>
          {WHY.map((t, i) => (
            <div className="c3" key={t} style={{ "--k": i }}>
              <span>{t}</span>
              <span className="yes">{Icon.check}</span>
              <span className="no">{Icon.cross}</span>
            </div>
          ))}
        </Reveal>
      </div></section>

      <section className="alt"><div className="wrap trust">
        {TRUST.map(([ic, h, p], i) => (
          <Reveal key={h} d={i * 100}>
            <div className="ti">{Icon[ic]}</div>
            <h3>{h}</h3><p className="mute sm">{p}</p>
          </Reveal>
        ))}
      </div></section>

      <Reviews alt={false} />

      <section className="alt"><div className="wrap split" style={{ alignItems: "start" }}>
        <Reveal><h2 className="h2">Good to know.</h2></Reveal>
        <Reveal d={120}>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</Reveal>
      </div></section>

      <Newsletter />
    </>
  );
}
