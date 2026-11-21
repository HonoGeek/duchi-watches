import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "./store";
import { Button, Field, Input, Panel, Select, Textarea } from "./ui";
import MomoPanel from "./MomoPanel";
import { RETURN_REASONS, livePays } from "./data";
import { dt, fmt, isPhone } from "./lib";

/* What a customer can do about one order, on the order page:
   send the payment details again, ask to cancel (while it is Processing), or ask to return it (after it is delivered, inside the
   return period the shop set in Admin > Policies). The shop answers each request from the admin area. */

const Note = ({ children, tone }) => <p className={`ac-note${tone ? " " + tone : ""}`}>{children}</p>;

function PaymentFix({ o }) {
  const { updateOrderPayment } = useStore();
  const [open, setOpen] = useState(false);
  const methods = livePays().filter((m) => m !== "Card"); // paying by card again is not offered here
  const [pay, setPay] = useState(methods.includes(o.pay) ? o.pay : methods[0]);
  const [pp, setPp] = useState(o.payPhone || "");
  const [tx, setTx] = useState("");
  const [err, setErr] = useState({});
  const momo = pay === "MTN Mobile Money" || pay === "Airtel Money";
  const failed = o.payStatus === "Failed";
  const save = (e) => {
    e.preventDefault();
    const er = {};
    if (momo && !pp.trim()) er.pp = "Enter the phone number you paid from, so we can match your payment.";
    else if (momo && !isPhone(pp)) er.pp = "That phone number does not look right. Use a number like 0788 123 456.";
    if (momo && tx.trim() && !/^[A-Za-z0-9]{4,40}$/.test(tx.trim())) er.tx = "The transaction ID uses letters and numbers only (4 to 40 characters).";
    setErr(er);
    if (Object.keys(er).length) return;
    if (updateOrderPayment(o.id, { pay, payPhone: pp, payRef: tx.trim() })) setOpen(false);
  };
  return (
    <Panel className="sm ac-act" style={{ marginBottom: 16 }}>
      <b style={{ fontWeight: 500 }}>{failed ? "We could not confirm your payment" : "Payment not confirmed yet"}</b>
      <Note tone={failed ? "bad" : ""}>
        {failed ? "Please check the details and send them again, or choose another way to pay." : "We confirm payments by hand, so this can take a little while. If you paid with a different number or method, you can send the details again."}
      </Note>
      {!open ? <div><Button variant="o" size="s" onClick={() => setOpen(true)}>{failed ? "Send payment details again" : "Update payment details"}</Button></div> : (
        <form className="stack" noValidate onSubmit={save}>
          <Field label="Pay with">
            <Select value={pay} onChange={(e) => { setPay(e.target.value); setErr({}); }}>{methods.map((m) => <option key={m}>{m}</option>)}</Select>
          </Field>
          {pay === "MTN Mobile Money" && <MomoPanel again net="mtn" amount={o.total} tx={tx} pp={pp} setTx={setTx} setPp={setPp} errTx={err.tx} errPp={err.pp} />}
          {pay === "Airtel Money" && <MomoPanel again net="airtel" amount={o.total} tx={tx} pp={pp} setTx={setTx} setPp={setPp} errTx={err.tx} errPp={err.pp} />}
          {pay === "Bank transfer" && <div className="paybox"><b>Pay by bank transfer</b><p className="sm mute" style={{ marginTop: 6 }}>We will send the bank details by WhatsApp or email. We dispatch once the transfer is confirmed.</p></div>}
          <div className="row"><Button>Save payment details</Button><Button type="button" variant="o" onClick={() => setOpen(false)}>Cancel</Button></div>
        </form>
      )}
    </Panel>
  );
}

function CancelBox({ o }) {
  const { requestCancel } = useStore();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState("");
  const [err, setErr] = useState("");
  const cr = o.cancelReq;
  const send = (e) => {
    e.preventDefault();
    if (why.trim().length < 5) { setErr("Please tell us briefly why you want to cancel."); return; }
    if (requestCancel(o.id, why)) { setOpen(false); setWhy(""); setErr(""); }
  };
  if (o.status !== "Processing" && !cr) return null;
  return (
    <Panel className="sm ac-act" style={{ marginBottom: 16 }}>
      <b style={{ fontWeight: 500 }}>Cancel this order</b>
      {cr?.status === "pending" && <Note>You asked to cancel this order on {dt(cr.date)}. We will answer as soon as we can. Your reason: “{cr.reason}”</Note>}
      {cr?.status === "declined" && <Note tone="bad">Your cancellation request was declined: {cr.answer}</Note>}
      {cr?.status === "approved" && <Note>Your cancellation request was approved.</Note>}
      {o.status === "Processing" && cr?.status !== "pending" && (!open
        ? <><Note>You can ask us to cancel while the order is still being prepared. We will answer you here.</Note><div><Button variant="o" size="s" onClick={() => setOpen(true)}>Request cancellation</Button></div></>
        : (
          <form className="stack" noValidate onSubmit={send}>
            <Field label="Why do you want to cancel?" error={err}><Textarea rows={3} maxLength={300} value={why} aria-invalid={!!err} onChange={(e) => { setWhy(e.target.value); setErr(""); }} /></Field>
            <div className="row"><Button>Send request</Button><Button type="button" variant="o" onClick={() => setOpen(false)}>Not now</Button></div>
          </form>
        ))}
    </Panel>
  );
}

function ReturnBox({ o }) {
  const { policies, requestReturn } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  if (o.status !== "Delivered") return null;
  const rr = o.returnReq, days = policies.returnDays;
  const until = new Date(new Date(o.deliveredAt || o.date).getTime() + days * 864e5);
  const open_ = days > 0 && until > new Date();
  const send = (e) => {
    e.preventDefault();
    if (!reason) { setErr("Choose a reason for the return."); return; }
    if (requestReturn(o.id, { reason, note })) { setOpen(false); setErr(""); }
  };
  return (
    <Panel className="sm ac-act" style={{ marginBottom: 16 }}>
      <b style={{ fontWeight: 500 }}>Returns and refunds</b>
      {rr?.status === "pending" && <Note>You asked to return this order on {dt(rr.date)} ({rr.reason}). We will answer as soon as we can.</Note>}
      {rr?.status === "approved" && <Note>We approved your return request. {rr.answer}</Note>}
      {rr?.status === "declined" && <Note tone="bad">Your return request was declined: {rr.answer}</Note>}
      {rr?.status === "refunded" && <Note>We recorded a refund of {fmt(rr.refund.amount)}{rr.refund.method ? ` (${rr.refund.method})` : ""} on {dt(rr.refund.date)}.</Note>}
      {!rr && !days && <Note>To return or exchange a watch, please <Link className="lnk" to="/contact">contact us</Link>. You can read our policy on the <Link className="lnk" to="/help#returns">Help page</Link>.</Note>}
      {!rr && days > 0 && !open_ && <Note>The {days}-day return period for this order has ended. Please <Link className="lnk" to="/contact">contact us</Link> if you have a question.</Note>}
      {!rr && open_ && (!open
        ? <><Note>You can ask to return this order until {dt(until)} ({days} days after delivery).</Note><div><Button variant="o" size="s" onClick={() => setOpen(true)}>Request a return</Button></div></>
        : (
          <form className="stack" noValidate onSubmit={send}>
            <Field label="Reason" error={err}>
              <Select value={reason} aria-invalid={!!err} onChange={(e) => { setReason(e.target.value); setErr(""); }}>
                <option value="">Choose a reason</option>{RETURN_REASONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Anything we should know? (optional)"><Textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <div className="row"><Button>Send request</Button><Button type="button" variant="o" onClick={() => setOpen(false)}>Not now</Button></div>
          </form>
        ))}
    </Panel>
  );
}

export default function OrderActions({ o }) {
  const open = ["Processing", "Dispatched"].includes(o.status);
  const needsPay = open && (o.payStatus || "Pending") !== "Paid";
  return (
    <>
      {needsPay && <PaymentFix key={o.pay + (o.payUpdatedAt || "")} o={o} />}
      <CancelBox o={o} />
      <ReturnBox o={o} />
    </>
  );
}
