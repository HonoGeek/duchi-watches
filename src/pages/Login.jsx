import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Button, Chip, Field, Input } from "../ui";

// Shared sign-in / create-account form (used on the login page and at checkout).
export function AuthBox({ onDone }) {
  const { signIn } = useStore();
  const [reg, setReg] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    signIn({ email: d.email, name: d.name, phone: d.phone, register: reg });
    onDone?.();
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <Chip on={!reg} onClick={() => setReg(false)}>Sign in</Chip>
        <Chip on={reg} onClick={() => setReg(true)}>Create account</Chip>
      </div>
      <form className="stack" onSubmit={submit} key={String(reg)}>
        {reg && <Field label="Full name"><Input name="name" required /></Field>}
        <Field label="Email"><Input name="email" type="email" required /></Field>
        {reg && <Field label="Phone number"><Input name="phone" type="tel" required placeholder="07XX XXX XXX" /></Field>}
        <Field label="Password"><Input name="pw" type="password" minLength={6} required /></Field>
        <Button block>{reg ? "Create account" : "Sign in"}</Button>
      </form>
    </>
  );
}

export default function Login() {
  const nav = useNavigate();
  return (
    <section style={{ paddingTop: 56 }}><div className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="h2" style={{ marginBottom: 24 }}>Welcome to DUCHI</h1>
      <AuthBox onDone={() => nav("/account")} />
    </div></section>
  );
}
