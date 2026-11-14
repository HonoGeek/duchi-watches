import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Button, Field, Input, Panel, Select, StockLeft, Textarea } from "../ui";
import { AuthBox } from "./Login";
import Cart from "./Cart";
import MomoPanel from "../MomoPanel";
import StripeCard from "../StripeCard";
import { PAYS } from "../data";
import { fmt } from "../lib";

export default function Checkout() {
  const { cart, products, user, addrs, zones, coupons, subtotal, placeOrder, showToast } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState({ n: "", ph: "", em: "", zi: 0, di: "", st: "", pay: PAYS[0], tx: "", pp: "" });
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [cp, setCp] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (user) setF((x) => ({ ...x, n: x.n || user.name, ph: x.ph || user.phone, em: x.em || user.email }));
  }, [user]);

  if (!cart.length) return <Cart />;
  if (!user) {
    return (
      <section style={{ paddingTop: 56 }}><div className="wrap" style={{ maxWidth: 460 }}>
        <h1 className="h2" style={{ marginBottom: 8 }}>Sign in to check out</h1>
        <p className="mute" style={{ marginBottom: 24 }}>Sign in or create an account to place your order and pay.</p>
        <AuthBox />
      </div></section>
    );
  }

  const disc = cp ? (cp.type === "pct" ? Math.round((subtotal * cp.val) / 100) : Math.min(cp.val, subtotal)) : 0;
  const fee = zones[f.zi]?.fee ?? 0;
  const total = Math.max(0, subtotal - disc) + fee;
  const apply = () => {
    const c = coupons.find((x) => x.active && x.code === code.trim().toUpperCase());
    if (c) { setCp(c); showToast("Coupon applied"); } else showToast("That coupon is not valid");
  };
  const useAddr = (e) => {
    const a = addrs[e.target.value];
    if (a) setF({ ...f, n: a.name, ph: a.phone, di: a.district, st: a.street, zi: a.zone });
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    let card = null;
    if (f.pay === "Card") {
      setBusy(true);
      card = await cardRef.current?.();
      setBusy(false);
      if (!card || card.error) { showToast(card?.error || "Please check your card details"); return; }
    }
    const id = placeOrder({
      name: f.n, phone: f.ph, cEmail: f.em, district: f.di, street: f.st, zi: +f.zi, pay: f.pay,
      coupon: cp?.code || null, disc, payRef: card ? card.id : f.tx.trim(), payPhone: f.pp.trim(),
      card: card ? { brand: card.brand, last4: card.last4 } : null,
    });
    nav("/success", { state: { id } });
  };

  return (
    <section style={{ paddingTop: 56 }}><div className="wrap">
      <h1 className="h2" style={{ marginBottom: 32 }}>Checkout</h1>
      <form className="cols" onSubmit={submit}>
        <div className="stack" style={{ gap: 28 }}>
          <div className="stack">
            <h2 className="h3">Contact and delivery</h2>
            {addrs.length > 0 && (
              <Field label="Saved addresses">
                <Select defaultValue="" onChange={useAddr}>
                  <option value="">Use a new address</option>
                  {addrs.map((a, i) => <option key={i} value={i}>{a.label}: {a.street}, {a.district}</option>)}
                </Select>
              </Field>
            )}
            <div className="two">
              <Field label="Full name"><Input required value={f.n} onChange={set("n")} /></Field>
              <Field label="Phone number"><Input required type="tel" placeholder="07XX XXX XXX" value={f.ph} onChange={set("ph")} /></Field>
            </div>
            <Field label="Email"><Input type="email" required value={f.em} onChange={set("em")} /></Field>
            <div className="two">
              <Field label="Delivery area">
                <Select value={f.zi} onChange={set("zi")}>
                  {zones.map((z, i) => <option key={i} value={i}>{z.name} ({fmt(z.fee)})</option>)}
                </Select>
              </Field>
              <Field label="District"><Input required placeholder="e.g. Gasabo" value={f.di} onChange={set("di")} /></Field>
            </div>
            <Field label="Delivery address"><Textarea rows={3} required placeholder="Sector, street, landmark" value={f.st} onChange={set("st")} /></Field>
          </div>
          <div className="stack">
            <h2 className="h3">Payment</h2>
            {PAYS.map((m) => (
              <label className="pay" key={m}>
                <input type="radio" name="pm" checked={f.pay === m} onChange={() => setF({ ...f, pay: m })} />{m}
              </label>
            ))}
            {f.pay === "MTN Mobile Money" && <MomoPanel net="mtn" amount={total} tx={f.tx} pp={f.pp} setTx={(v) => setF((x) => ({ ...x, tx: v }))} setPp={(v) => setF((x) => ({ ...x, pp: v }))} />}
            {f.pay === "Airtel Money" && <MomoPanel net="airtel" amount={total} tx={f.tx} pp={f.pp} setTx={(v) => setF((x) => ({ ...x, tx: v }))} setPp={(v) => setF((x) => ({ ...x, pp: v }))} />}
            {f.pay === "Card" && <StripeCard reg={cardRef} name={f.n} email={f.em} />}
            {f.pay === "Bank transfer" && <div className="paybox"><b>Pay by bank transfer</b><p className="sm mute" style={{ marginTop: 6 }}>Place your order and we will send the bank details by WhatsApp or email. We dispatch once the transfer is confirmed.</p></div>}
          </div>
        </div>
        <Panel className="sum">
          <h2 className="h3" style={{ marginBottom: 12 }}>Order summary</h2>
          {cart.map((x) => (
            <div className="r sm" key={x.id}>
              <span>{products[x.id].n} × {x.q}<StockLeft p={products[x.id]} q={x.q} /></span>
              <span>{fmt(products[x.id].p * x.q)}</span>
            </div>
          ))}
          <div className="r" style={{ marginTop: 8 }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {disc > 0 && <div className="r"><span>Discount</span><span>−{fmt(disc)}</span></div>}
          <div className="r"><span>Delivery</span><span>{fmt(fee)}</span></div>
          <div className="r tot"><span>Total</span><span>{fmt(total)}</span></div>
          <div className="row" style={{ marginTop: 16, flexWrap: "nowrap" }}>
            <Input placeholder="Coupon code" aria-label="Coupon code" style={{ flex: 1 }} value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} />
            <Button type="button" variant="o" onClick={apply}>Apply</Button>
          </div>
          <Button variant="g" block disabled={busy} style={{ marginTop: 16 }}>{busy ? "Checking card..." : "Place order"}</Button>
        </Panel>
      </form>
    </div></section>
  );
}
