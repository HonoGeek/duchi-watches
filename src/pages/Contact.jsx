import { useState } from "react";
import { useStore } from "../store";
import { Button, Field, Input, Panel, Textarea } from "../ui";
import { isEmail, isName, isPhone } from "../lib";

const MAX = 1000;

export default function Contact() {
  const { addMessage, site } = useStore();
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState({});
  const [len, setLen] = useState(0);
  const clear = (k) => () => setErr((x) => (x[k] ? { ...x, [k]: undefined } : x));
  const submit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    const er = {};
    if (!isName(d.name)) er.name = "Enter your name.";
    if (!isEmail(d.email)) er.email = "Enter a valid email address, like name@example.com.";
    if (d.phone.trim() && !isPhone(d.phone)) er.phone = "Enter a valid phone number, like 0788 123 456, or leave it empty.";
    if (d.message.trim().length < 10) er.message = "Please write at least 10 characters so we can help you.";
    if (Object.keys(er).length) {
      setErr(er);
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setErr({});
    if (addMessage({ name: d.name, email: d.email, phone: d.phone, text: d.message })) { setSent(true); setLen(0); }
  };
  return (
    <section style={{ paddingTop: 56 }}><div className="wrap split" style={{ alignItems: "start" }}>
      <div className="stack">
        <h1 className="h2">How can we help?</h1>
        <p className="lead">Questions about a watch, delivery or payment? Send us a message and we will reply quickly.</p>
        <Panel className="stack sm">
          {site.phone && <div><b>WhatsApp</b><div className="mute">{site.phone}</div></div>}
          <div><b>Email</b><div className="mute">{site.email}</div></div>
          <div><b>Location</b><div className="mute">{site.place}</div></div>
        </Panel>
      </div>
      {sent ? (
        <Panel className="stack"><h2 className="h3">Message sent</h2><p className="mute">Thanks, we will get back to you soon.</p><div><Button type="button" variant="o" size="s" onClick={() => setSent(false)}>Send another message</Button></div></Panel>
      ) : (
        <form className="stack" noValidate onSubmit={submit}>
          <Field label="Name" error={err.name}><Input name="name" maxLength={80} autoComplete="name" aria-invalid={!!err.name} onChange={clear("name")} /></Field>
          <div className="two">
            <Field label="Email" error={err.email}><Input name="email" type="email" inputMode="email" maxLength={120} autoComplete="email" aria-invalid={!!err.email} onChange={clear("email")} /></Field>
            <Field label="Phone (optional)" error={err.phone}><Input name="phone" type="tel" inputMode="tel" maxLength={20} placeholder="07XX XXX XXX" autoComplete="tel" aria-invalid={!!err.phone} onChange={clear("phone")} /></Field>
          </div>
          <div>
            <Field label="Message" error={err.message}>
              <Textarea name="message" rows={5} maxLength={MAX} aria-invalid={!!err.message} onChange={(e) => { setLen(e.target.value.length); clear("message")(); }} />
            </Field>
            <div className="pf-cnt">{len} / {MAX}</div>
          </div>
          <Button>Send message</Button>
        </form>
      )}
    </div></section>
  );
}
