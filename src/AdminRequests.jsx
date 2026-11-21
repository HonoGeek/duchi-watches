import { useState } from "react";
import { useStore } from "./store";
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

export default function RequestsPanel({ o }) {
  return <>{o.cancelReq && <CancelPanel o={o} />}{o.returnReq && <ReturnPanel o={o} />}</>;
}
