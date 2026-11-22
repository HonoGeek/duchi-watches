import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useStore } from "./store";
import { Button, Panel, Select } from "./ui";
import { PAY_STATUS, ST } from "./data";
import { orderMessage, smsLink, waLink } from "./pay";
import RequestsPanel, { StockPanel } from "./AdminRequests";
import { hasReq, openItems } from "./orderState";
import { dtm, fmt, tm } from "./lib";
import "./order-view.css";

/* One order, everything about it: used by the full page (Admin > Orders > an order) and by the side panel that opens
   from the Orders list. Anything waiting for the admin (a request, a refund, a restock decision) is shown first. */

export const PayPill = ({ s }) => <span className={`pill ${s === "Paid" ? "good" : s === "Failed" ? "bad" : "warn"}`}>{s}</span>;

export const StatusSelect = ({ o }) => {
  const { setOrderStatus, ask } = useStore();
  return (
    <Select style={{ height: 36, width: "auto" }} value={o.status} aria-label="Order status"
      onChange={(e) => {
        const v = e.target.value;
        if (v === "Cancelled") { // asks in a toast first; the list keeps the old status until the answer is Yes
          ask(`Cancel order ${o.id}? The watches go back into stock and the customer is told it was cancelled.`, () => setOrderStatus(o.id, v), { yes: "Yes, cancel order", no: "No, keep it" });
          return;
        }
        setOrderStatus(o.id, v);
      }}>
      {ST.map((s) => <option key={s}>{s}</option>)}
    </Select>
  );
};

export const PaySelect = ({ o }) => {
  const { setPayStatus } = useStore();
  return (
    <Select style={{ height: 36, width: "auto" }} value={o.payStatus || "Pending"} onChange={(e) => setPayStatus(o.id, e.target.value)} aria-label="Payment status">
      {PAY_STATUS.map((s) => <option key={s}>{s}</option>)}
    </Select>
  );
};

// What happened to this order, from the activity log (newest first).
function Activity({ o }) {
  const { audit } = useStore();
  const list = audit.filter((a) => a.m.includes(o.id)).slice(0, 10);
  if (!list.length) return null;
  return (
    <Panel className="sm" style={{ marginBottom: 16 }}>
      <b style={{ fontWeight: 500 }}>Activity</b>
      <ul className="od-act">
        {list.map((a, i) => <li key={a.t + i}><span>{a.m}</span><span className="mute">{a.w}, {tm(a.t)}</span></li>)}
      </ul>
    </Panel>
  );
}

export function OrderBody({ o }) {
  const { getProduct } = useStore();
  const urgent = hasReq(o);
  return (
    <>
      {urgent && (
        <div className="od-alert" role="region" aria-label="Needs your attention">
          <p className="od-alert-h">Needs your attention: {openItems(o).join(", ")}</p>
          <RequestsPanel o={o} />
        </div>
      )}
      <Panel style={{ marginBottom: 16 }}>
        {o.items.map((x) => <div className="r row" style={{ justifyContent: "space-between", padding: "8px 0" }} key={x.id}><span>{x.n || getProduct(x.id)?.n || "Removed watch"} × {x.q}</span><span>{fmt(x.p * x.q)}</span></div>)}
        <div className="sum">
          <div className="r"><span>Subtotal</span><span>{fmt(o.sub)}</span></div>
          {o.disc > 0 && <div className="r"><span>Discount {o.coupon}</span><span>−{fmt(o.disc)}</span></div>}
          <div className="r"><span>Delivery, {o.area}</span><span>{fmt(o.fee)}</span></div>
          <div className="r tot"><span>Total</span><span>{fmt(o.total)}</span></div>
        </div>
      </Panel>
      <Panel className="sm" style={{ marginBottom: 16 }}>
        <b style={{ fontWeight: 500 }}>Contact the customer</b>
        <p className="mute" style={{ margin: "6px 0 12px" }}>{o.name}<br />{o.phone}<br />{o.cEmail || o.email}</p>
        <div className="row">
          <Button variant="o" size="s" href={`tel:${o.phone}`}>Call</Button>
          <Button variant="o" size="s" href={waLink(o.phone, orderMessage(o))} target="_blank" rel="noopener noreferrer">WhatsApp update</Button>
          <Button variant="o" size="s" href={smsLink(o.phone, orderMessage(o))}>SMS update</Button>
          <Button variant="o" size="s" href={`mailto:${o.cEmail || o.email}`}>Email</Button>
        </div>
        <p className="fhint" style={{ marginTop: 8 }}>The update opens in WhatsApp or your messages app with a short message already typed, based on where the order is now. You press send.</p>
        <b style={{ fontWeight: 500, display: "block", marginTop: 16 }}>Delivery address</b>
        <p className="mute">{o.street}, {o.district} ({o.area})</p>
      </Panel>
      <Panel className="sm" style={{ marginBottom: 16 }}>
        <div className="head" style={{ marginBottom: 8, alignItems: "center" }}>
          <b style={{ fontWeight: 500 }}>Payment</b>
          <PaySelect o={o} />
        </div>
        <p className="mute">{o.pay}{o.card ? `, card ending ${o.card.last4}` : ""}</p>
        {o.payRef && <p className="mute">Reference: {o.payRef}</p>}
        {o.payPhone && <p className="mute">Paid from: <a href={`tel:${o.payPhone}`}>{o.payPhone}</a></p>}
        {o.payUpdatedAt && <p className="mute">The customer sent the payment details again on {dtm(o.payUpdatedAt)}.</p>}
      </Panel>
      {!urgent && <RequestsPanel o={o} />}
      <StockPanel o={o} />
      <Activity o={o} />
    </>
  );
}

/* The side panel on the Orders list: the whole order without leaving the list. Escape, the X or a click outside closes it. */
export function OrderDrawer({ id, onClose }) {
  const { allOrders } = useStore();
  const o = allOrders.find((x) => x.id === id);
  const box = useRef(null);
  const keep = useRef(onClose);
  keep.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !document.querySelector(".toast.ask")) { keep.current(); return; } // Escape first answers a question shown in a toast
      if (e.key !== "Tab") return;
      const f = [...(box.current?.querySelectorAll("a[href], button, select, input, textarea") || [])].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; before?.focus?.(); };
  }, []);
  if (!o) return null;
  return createPortal(
    <div className="odw" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="odw-box" role="dialog" aria-modal="true" aria-labelledby="odw-title" ref={box} tabIndex={-1}>
        <div className="odw-h">
          <div><h2 id="odw-title">Order {o.id}</h2><p>Placed {tm(o.date)} by {o.name}</p></div>
          <button type="button" className="odw-x" onClick={onClose} aria-label="Close order details">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="odw-bar">
          <StatusSelect o={o} />
          <Button to={`/receipt/${o.id}`} variant="o" size="s">Receipt</Button>
          <Link className="btn btn-o btn-s" to={`/admin/orders/${o.id}`}>Open full page</Link>
        </div>
        <div className="odw-b"><OrderBody o={o} /></div>
      </aside>
    </div>,
    document.body
  );
}
