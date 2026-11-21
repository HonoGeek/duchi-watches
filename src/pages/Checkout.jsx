import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Button, Field, Input, Panel, Select, StockLeft, Textarea } from "../ui";
import { AuthBox } from "./Login";
import Cart from "./Cart";
import MomoPanel from "../MomoPanel";
import StripeCard from "../StripeCard";
import { PAYS } from "../data";
import { clean, fmt, isEmail, isName, isPhone } from "../lib";

export default function Checkout() {
  const { cart, products, user, addrs, zones, coupons, subtotal, placeOrder, showToast } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState({ n: "", ph: "", em: "", zi: 0, di: "", st: "", pay: PAYS[0], tx: "", pp: "" });
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [cp, setCp] = useState(null);
  const [errs, setErrs] = useState({}); // one message per field that needs fixing
  const lock = useRef(false);          // stops a double click from placing the order twice
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs((x) => ({ ...x, [k]: undefined })); };
  const bad = (k) => ({ "aria-invalid": !!errs[k] });

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
    const v = code.trim().toUpperCase();
    if (!v) { showToast("Enter a coupon code first", { type: "err" }); return; }
    if (cp && cp.code === v) { showToast("That coupon is already applied"); return; }
    const c = coupons.find((x) => x.active && x.code === v);
    if (c) { setCp(c); showToast("Coupon applied"); } else showToast("That coupon is not valid", { type: "err" });
  };
  const isMomo = f.pay === "MTN Mobile Money" || f.pay === "Airtel Money";
  const validate = () => {
    const er = {};
    if (!isName(f.n)) er.n = "Enter the full name for delivery.";
    if (!isPhone(f.ph)) er.ph = "Enter a valid phone number, like 0788 123 456.";
    if (!isEmail(f.em)) er.em = "Enter a valid email address, like name@example.com.";
    if (!zones[f.zi]) er.zi = "Choose a delivery area.";
    if (clean(f.di).length < 2) er.di = "Enter the district, for example Gasabo.";
    if (clean(f.st).length < 5) er.st = "Enter the sector, street and a landmark.";
    if (isMomo && !f.pp.trim()) er.pp = "Enter the phone number you paid from, so we can match your payment.";
    else if (isMomo && !isPhone(f.pp)) er.pp = "That phone number does not look right. Use a number like 0788 123 456.";
    if (isMomo && f.tx.trim() && !/^[A-Za-z0-9]{4,40}$/.test(f.tx.trim())) er.tx = "The transaction ID uses letters and numbers only (4 to 40 characters).";
    return er;
  };
  const useAddr = (e) => {
    const a = addrs[e.target.value];
    if (a) { setF({ ...f, n: a.name, ph: a.phone, di: a.district, st: a.street, zi: a.zone }); setErrs({}); }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy || lock.current) return;
    const form = e.currentTarget;
    const er = validate();
    if (Object.keys(er).length) {
      setErrs(er);
      showToast("Please check the highlighted fields", { type: "err" });
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setErrs({});
    lock.current = true;
    try {
      let card = null;
      if (f.pay === "Card") {
        setBusy(true);
        card = await cardRef.current?.();
        setBusy(false);
        if (!card || card.error) { showToast(card?.error || "Please check your card details", { type: "err" }); return; }
      }
      const id = placeOrder({
        name: f.n, phone: f.ph, cEmail: f.em, district: f.di, street: f.st, zi: +f.zi, pay: f.pay,
        coupon: cp?.code || null, payRef: card ? card.id : f.tx.trim(), payPhone: f.pp.trim(),
        card: card ? { brand: card.brand, last4: card.last4 } : null,
      });
      if (id) nav("/success", { state: { id } }); // placeOrder explains the problem itself when it returns nothing
    } finally { lock.current = false; }
  };

  return (
    <section style={{ paddingTop: 56 }}><div className="wrap">
      <h1 className="h2" style={{ marginBottom: 32 }}>Checkout</h1>
      <form className="cols" noValidate onSubmit={submit}>
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
              <Field label="Full name" error={errs.n}><Input value={f.n} maxLength={60} autoComplete="name" onChange={set("n")} {...bad("n")} /></Field>
              <Field label="Phone number" error={errs.ph}><Input type="tel" inputMode="tel" maxLength={20} placeholder="07XX XXX XXX" autoComplete="tel" value={f.ph} onChange={set("ph")} {...bad("ph")} /></Field>
            </div>
            <Field label="Email" error={errs.em}><Input type="email" inputMode="email" maxLength={120} autoComplete="email" value={f.em} onChange={set("em")} {...bad("em")} /></Field>
            <div className="two">
              <Field label="Delivery area" error={errs.zi}>
                <Select value={f.zi} onChange={set("zi")} {...bad("zi")}>
                  {zones.map((z, i) => <option key={i} value={i}>{z.name} ({fmt(z.fee)})</option>)}
                </Select>
              </Field>
              <Field label="District" error={errs.di}><Input placeholder="e.g. Gasabo" maxLength={40} value={f.di} onChange={set("di")} {...bad("di")} /></Field>
            </div>
            <Field label="Delivery address" error={errs.st}><Textarea rows={3} maxLength={300} placeholder="Sector, street, landmark" value={f.st} onChange={set("st")} {...bad("st")} /></Field>
          </div>
          <div className="stack">
            <h2 className="h3">Payment</h2>
            {PAYS.map((m) => (
              <label className="pay" key={m}>
                <input type="radio" name="pm" checked={f.pay === m} onChange={() => setF({ ...f, pay: m })} />{m}
              </label>
            ))}
            {f.pay === "MTN Mobile Money" && <MomoPanel net="mtn" amount={total} tx={f.tx} pp={f.pp} errTx={errs.tx} errPp={errs.pp} setTx={(v) => { setF((x) => ({ ...x, tx: v })); setErrs((x) => ({ ...x, tx: undefined })); }} setPp={(v) => { setF((x) => ({ ...x, pp: v })); setErrs((x) => ({ ...x, pp: undefined })); }} />}
            {f.pay === "Airtel Money" && <MomoPanel net="airtel" amount={total} tx={f.tx} pp={f.pp} errTx={errs.tx} errPp={errs.pp} setTx={(v) => { setF((x) => ({ ...x, tx: v })); setErrs((x) => ({ ...x, tx: undefined })); }} setPp={(v) => { setF((x) => ({ ...x, pp: v })); setErrs((x) => ({ ...x, pp: undefined })); }} />}
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
            <Input placeholder="Coupon code" aria-label="Coupon code" maxLength={20} style={{ flex: 1 }} value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }} />
            <Button type="button" variant="o" onClick={apply}>Apply</Button>
          </div>
          {cp && <p className="sm mute" style={{ marginTop: 8 }}>Coupon {cp.code} applied. <button type="button" className="lnk" onClick={() => { setCp(null); setCode(""); }}>Remove</button></p>}
          <Button variant="g" block disabled={busy} style={{ marginTop: 16 }}>{busy ? "Checking card..." : "Place order"}</Button>
        </Panel>
      </form>
    </div></section>
  );
}
