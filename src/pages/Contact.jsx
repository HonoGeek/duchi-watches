import { useState } from "react";
import { Button, Field, Input, Panel, Textarea } from "../ui";

export default function Contact() {
  const [sent, setSent] = useState(false);
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
        <Panel><h2 className="h3">Message sent</h2><p className="mute">Thanks, we will get back to you soon.</p></Panel>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <Field label="Name"><Input required /></Field>
          <div className="two">
            <Field label="Email"><Input type="email" required /></Field>
            <Field label="Phone"><Input type="tel" /></Field>
          </div>
          <Field label="Message"><Textarea rows={5} required /></Field>
          <Button>Send message</Button>
        </form>
      )}
    </div></section>
  );
}
