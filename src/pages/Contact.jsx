import { useState } from "react";
import { useStore } from "../store";
import { Button, Field, Input, Panel, Textarea } from "../ui";

export default function Contact() {
  const { addMessage } = useStore();
  const [sent, setSent] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    addMessage({ name: d.name, email: d.email, phone: d.phone, text: d.message });
    setSent(true);
  };
  return (
    <section style={{ paddingTop: 56 }}><div className="wrap split" style={{ alignItems: "start" }}>
      <div className="stack">
        <h1 className="h2">How can we help?</h1>
        <p className="lead">Questions about a watch, delivery or payment? Send us a message and we will reply quickly.</p>
        <Panel className="stack sm">
          <div><b>WhatsApp</b><div className="mute">+250 000 000 000</div></div>
          <div><b>Email</b><div className="mute">hello@duchistore.rw</div></div>
          <div><b>Location</b><div className="mute">Kigali, Rwanda</div></div>
        </Panel>
      </div>
      {sent ? (
        <Panel className="stack"><h2 className="h3">Message sent</h2><p className="mute">Thanks, we will get back to you soon.</p><div><Button type="button" variant="o" size="s" onClick={() => setSent(false)}>Send another message</Button></div></Panel>
      ) : (
        <form className="stack" onSubmit={submit}>
          <Field label="Name"><Input name="name" required maxLength={80} autoComplete="name" /></Field>
          <div className="two">
            <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
            <Field label="Phone"><Input name="phone" type="tel" autoComplete="tel" /></Field>
          </div>
          <Field label="Message"><Textarea name="message" rows={5} required maxLength={1000} /></Field>
          <Button>Send message</Button>
        </form>
      )}
    </div></section>
  );
}
