import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../store";
import { Button, Icon } from "../ui";
import { fmt } from "../lib";

// The policy text is written by the shop owner in Admin > Policies. While one is empty, its section shows a "being finalised"
// note, so the page never states a rule nobody wrote. Delivery fees come from the shipping zones automatically.

const TOPICS = [
  ["delivery", "Delivery", "truck"],
  ["returns", "Returns and exchanges", "returns"],
  ["warranty", "Warranty", "shield"],
  ["tracking", "Order tracking", "pin"],
];

// Shown while a policy has not been written yet. Never states anything about the policy itself.
function Pending() {
  return (
    <div className="help-pending">
      <p className="mute">We are finalising this information. Until it is published, message us on WhatsApp or use the contact page and we will answer your question directly.</p>
      <Button to="/contact" variant="o" size="s">Contact us</Button>
    </div>
  );
}

const Paras = ({ list }) => list.map((t, i) => <p key={i}>{t}</p>);

export default function Help() {
  const { zones, user, policies } = useStore();
  const { hash } = useLocation();

  // Footer and FAQ links use /help#returns and so on: scroll to the section after the page has rendered.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }, [hash]);

  return (
    <section style={{ paddingTop: 56 }}><div className="wrap">
      <h1 className="h2">Help and policies</h1>
      <p className="sub">Everything about delivery, returns, warranty and tracking your order, in one place.</p>

      <div className="help">
        <nav className="help-nav" aria-label="Help topics">
          {TOPICS.map(([id, label, ic]) => <Link key={id} to={`/help#${id}`} className={hash === `#${id}` ? "on" : ""}>{Icon[ic]}<span>{label}</span></Link>)}
        </nav>

        <div className="help-body">
          <article id="delivery" className="help-sec">
            <h2 className="h3">Delivery</h2>
            {zones.length > 0 && (
              <ul className="help-fees">
                {zones.map((z) => <li key={z.name}><span>{z.name}</span><b>{fmt(z.fee)}</b></li>)}
              </ul>
            )}
            {policies.delivery.length ? <Paras list={policies.delivery} /> : <Pending />}
          </article>

          <article id="returns" className="help-sec">
            <h2 className="h3">Returns and exchanges</h2>
            {policies.returnDays > 0 && <p>You can ask to return a delivered watch from your account, within {policies.returnDays} days of delivery.</p>}
            {policies.returns.length ? <Paras list={policies.returns} /> : policies.returnDays > 0 ? null : <Pending />}
          </article>

          <article id="warranty" className="help-sec">
            <h2 className="h3">Warranty</h2>
            {policies.warranty.length ? <Paras list={policies.warranty} /> : <Pending />}
          </article>

          <article id="tracking" className="help-sec">
            <h2 className="h3">Order tracking</h2>
            {policies.tracking.length ? <Paras list={policies.tracking} /> : <Pending />}
            <Button to={user ? "/account/orders" : "/login"} variant="o" size="s">{user ? "View my orders" : "Sign in to track my order"}</Button>
          </article>
        </div>
      </div>
    </div></section>
  );
}

// Terms of sale and privacy policy share one layout. Route: <Legal kind="terms" /> and <Legal kind="privacy" />.
const LEGAL = {
  terms: ["Terms of sale", "The conditions that apply when you buy from DUCHI."],
  privacy: ["Privacy policy", "How DUCHI collects, uses and protects your information."],
};
export function Legal({ kind }) {
  const { policies } = useStore();
  const [title, intro] = LEGAL[kind];
  const body = policies[kind];
  return (
    <section style={{ paddingTop: 56 }}><div className="wrap help-legal">
      <h1 className="h2">{title}</h1>
      <p className="sub">{intro}</p>
      <div className="help-sec">{body.length ? <Paras list={body} /> : <Pending />}</div>
    </div></section>
  );
}
