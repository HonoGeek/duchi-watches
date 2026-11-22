import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "./store";
import { isMomo, refundDue, restockDue } from "./orderState";
import { Button, Field, Input, Panel, Textarea } from "./ui";
import { dt, dtm, fmt } from "./lib";

/* Admin > Orders > one order: the customer's cancellation and return requests, and how to answer them.
   Approving a cancellation cancels the order (the watches go back in stock). A refund is recorded here after the money was
   sent back by hand (MoMo or bank): recording it does not move any money, and it is taken off the revenue on the dashboard. */

const Pill = ({ s }) => <span className={`pill ${s === "pending" ? "warn" : s === "declined" ? "bad" : "good"}`}>{{ pending: "Waiting for you", approved: "Approved", declined: "Declined", refunded: "Refunded" }[s]}</span>;
const Row = ({ k, children }) => <p className="mute" style={{ margin: "4px 0" }}><span style={{ display: "inline-block", minWidth: 96 }}>{k}</span>{children}</p>;

function CancelPanel({ o }) {
  const { answerCancel, ask } = useStore();
  const cr = o.cancelReq;
  const [declining, setDeclining] = useState(false);
  const [text, setText] = useState("");
  return (
    <Panel className="sm" style={{ marginBottom: 16 }}>
      <div className="head" style={{ marginBottom: 8, alignItems: "center" }}><b style={{ fontWeight: 500 }}>Cancellation request</b><Pill s={cr.status} /></div>
      <Row k="Asked on">{dtm(cr.date)}</Row>
      <Row k="Reason">{cr.reason}</Row>
      {cr.status === "pending" && (
        <>
          {o.status !== "Processing" && <p className="mute" style={{ color: "#b26a00" }}>This order is already {o.status.toLowerCase()}. You may want to decline.</p>}
          {!declining ? (
            <div className="row" style={{ marginTop: 10 }}>
              <Button size="s" onClick={() => ask(`Approve the request and cancel order ${o.id}? The watches go back into stock and the customer is told.`, () => answerCancel(o.id, true), { yes: "Yes, cancel order", no: "No" })}>Approve and cancel order</Button>
              <Button variant="o" size="s" onClick={() => setDeclining(true)}>Decline</Button>
            </div>
          ) : (
            <form className="stack" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (answerCancel(o.id, false, text)) setDeclining(false); }}>
              <Field label="Tell the customer why (needed to decline)"><Textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></Field>
              <div className="row"><Button size="s">Send answer</Button><Button type="button" variant="o" size="s" onClick={() => setDeclining(false)}>Back</Button></div>
            </form>
          )}
        </>
      )}
      {cr.status === "declined" && <Row k="Your answer">{cr.answer}</Row>}
      {cr.answeredAt && <Row k="Answered on">{dtm(cr.answeredAt)}</Row>}
    </Panel>
  );
}

function ReturnPanel({ o }) {
  const { answerReturn } = useStore();
  const rr = o.returnReq;
  const [text, setText] = useState("");
  const [amount, setAmount] = useState(String(o.total));
  const [how, setHow] = useState("");
  return (
    <Panel className="sm" style={{ marginBottom: 16 }}>
      <div className="head" style={{ marginBottom: 8, alignItems: "center" }}><b style={{ fontWeight: 500 }}>Return request</b><Pill s={rr.status} /></div>
      <Row k="Asked on">{dtm(rr.date)}</Row>
      <Row k="Delivered">{o.deliveredAt ? dtm(o.deliveredAt) : "Date not recorded"}</Row>
      <Row k="Reason">{rr.reason}</Row>
      {rr.note && <Row k="Note">{rr.note}</Row>}
      {rr.status === "pending" && (
        <form className="stack" style={{ marginTop: 10 }} onSubmit={(e) => e.preventDefault()}>
          <Field label="Message to the customer (needed to decline, optional to approve)"><Textarea rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <div className="row">
            <Button type="button" size="s" onClick={() => answerReturn(o.id, "approved", { answer: text })}>Approve return</Button>
            <Button type="button" variant="o" size="s" onClick={() => answerReturn(o.id, "declined", { answer: text })}>Decline</Button>
          </div>
        </form>
      )}
      {rr.status === "approved" && (
        <form className="stack" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); answerReturn(o.id, "refunded", { amount, method: how }); }}>
          {rr.answer && <Row k="Your message">{rr.answer}</Row>}
          <p className="mute" style={{ margin: 0 }}>Send the money back by MoMo or bank transfer first, then record it here. Recording a refund does not send any money.</p>
          <div className="two">
            <Field label="Refund (RWF)"><Input type="number" inputMode="numeric" min="1" max={o.total} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="How it was sent (optional)"><Input maxLength={100} placeholder="e.g. MTN MoMo to 0788 123 456" value={how} onChange={(e) => setHow(e.target.value)} /></Field>
          </div>
          <div><Button size="s">Record refund</Button></div>
        </form>
      )}
      {rr.status === "declined" && <Row k="Your answer">{rr.answer}</Row>}
      {rr.status === "refunded" && <Row k="Refund">{fmt(rr.refund.amount)}{rr.refund.method ? `, ${rr.refund.method}` : ""} on {dt(rr.refund.date)}</Row>}
    </Panel>
  );
}

// After a cancellation: money that may have to go back to the customer. Nothing is sent from here; you record it afterwards.
function RefundPanel({ o }) {
  const { recordCancelRefund, dismissRefundCheck } = useStore();
  const [amount, setAmount] = useState(String(o.total));
  const [how, setHow] = useState("");
  const check = o.refundCheck === "check", due = refundDue(o);
  return (
    <Panel className="sm" style={{ marginBottom: 16 }}>
      <div className="head" style={{ marginBottom: 8, alignItems: "center" }}>
        <b style={{ fontWeight: 500 }}>Money after the cancellation</b>
        <span className={`pill ${o.refund ? "good" : due ? "warn" : "off"}`}>{o.refund ? "Refunded" : due ? (check ? "Check payment" : "Refund due") : "Nothing owed"}</span>
      </div>
      {o.cancelledBy === "customer" && <Row k="Cancelled">by the customer, on {dtm(o.cancelledAt)}</Row>}
      {due && (
        <form className="stack" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); recordCancelRefund(o.id, { amount, method: how }); }}>
          <p className="mute" style={{ margin: 0 }}>
            {check
              ? `They cancelled before you confirmed a payment. They pay by ${o.pay}${o.payPhone ? ` from ${o.payPhone}` : ""}, and customers usually send the money before they place the order, so please check your ${isMomo(o) ? "MoMo" : "bank"} records. `
              : "This order was paid and then cancelled. "}
            If the money arrived, send it back by MoMo or bank transfer first, then record it here. Recording a refund does not send any money.
          </p>
          <div className="two">
            <Field label="Refund (RWF)"><Input type="number" inputMode="numeric" min="1" max={o.total} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="How it was sent (optional)"><Input maxLength={100} placeholder="e.g. MTN MoMo to 0788 123 456" value={how} onChange={(e) => setHow(e.target.value)} /></Field>
          </div>
          <div className="row">
            <Button size="s">Record refund</Button>
            <Button type="button" variant="o" size="s" onClick={() => dismissRefundCheck(o.id)}>{check ? "No money was received" : "No refund needed"}</Button>
          </div>
        </form>
      )}
      {o.refund && <Row k="Refund">{fmt(o.refund.amount)}{o.refund.method ? `, ${o.refund.method}` : ""} on {dt(o.refund.date)}</Row>}
      {!due && !o.refund && o.refundCheck === "none" && <p className="mute" style={{ margin: "6px 0 0" }}>You marked that nothing is owed on this order.</p>}
    </Panel>
  );
}

// Where the watches of this order are in the stock books, and the manual controls the system cannot decide by itself.
export function StockPanel({ o }) {
  const { getProduct, restockReturn, ask } = useStore();
  const rr = o.returnReq, due = restockDue(o);
  const sum = o.items.map((x) => `${x.q} × ${x.n || getProduct(x.id)?.n || "watch"}`).join(", ");
  return (
    <Panel className="sm" style={{ marginBottom: 16 }}>
      <b style={{ fontWeight: 500 }}>Stock</b>
      <ul className="od-stock">
        {o.items.map((x) => {
          const p = getProduct(x.id), name = x.n || p?.n || "Watch no longer sold";
          return (
            <li key={x.id}>
              <span>{name} × {x.q}</span>
              <span className="mute">{p ? <>In stock now: <b style={{ fontWeight: 500 }}>{p.stock}</b> · <Link className="lnk" to={`/admin/products?q=${encodeURIComponent(p.n)}`}>Adjust stock</Link></> : "Product removed"}</span>
            </li>
          );
        })}
      </ul>
      {rr?.restock === "yes" && <p className="mute" style={{ margin: 0 }}>The returned watches were put back in stock on {dt(rr.restockedAt)}.</p>}
      {rr?.restock === "no" && <p className="mute" style={{ margin: 0 }}>The returned watches were not added back to the stock (not for resale), decided on {dt(rr.restockedAt)}.</p>}
      {due && (
        <>
          <p className="mute" style={{ margin: "0 0 10px" }}>The customer is returning these watches. When you have them, decide whether they go back on sale. A damaged watch should not.</p>
          <div className="row">
            <Button size="s" onClick={() => ask(`Add ${sum} back into the stock?`, () => restockReturn(o.id, true), { yes: "Yes, add to stock", no: "No" })}>Put back in stock</Button>
            <Button variant="o" size="s" onClick={() => ask("Keep the returned watches out of the stock (damaged or not for resale)?", () => restockReturn(o.id, false), { yes: "Yes, do not restock", no: "No" })}>Do not restock</Button>
          </div>
        </>
      )}
      {!rr && o.status === "Cancelled" && <p className="mute" style={{ margin: 0 }}>The watches went back into the stock when the order was cancelled{o.restockedAt ? ` (${dt(o.restockedAt)})` : ""}.</p>}
      {!rr && o.status !== "Cancelled" && <p className="mute" style={{ margin: 0 }}>The watches were taken out of the stock when the order was placed.</p>}
    </Panel>
  );
}

export default function RequestsPanel({ o }) {
  return (
    <>
      {o.cancelReq && <CancelPanel o={o} />}
      {o.returnReq && <ReturnPanel o={o} />}
      {o.status === "Cancelled" && (refundDue(o) || o.refund || o.cancelledBy === "customer") && <RefundPanel o={o} />}
    </>
  );
}
