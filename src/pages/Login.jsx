import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { Button, Chip, Field, Input } from "../ui";
import { isEmail, isName, isPhone } from "../lib";

// Shared sign-in / create-account form (used on the login page and at checkout).
// Every field is checked before anything is sent, and the messages tell the customer what to fix.
export function AuthBox({ onDone }) {
  const { signIn } = useStore();
  const [reg, setReg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState({}); // { name, email, phone, pw, pw2, form }

  const switchTo = (r) => { setReg(r); setErr({}); };
  const clear = (k) => () => setErr((x) => (x[k] || x.form ? { ...x, [k]: undefined, form: undefined } : x));
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    const er = {};
    if (reg && !isName(d.name)) er.name = "Enter your full name.";
    if (!isEmail(d.email)) er.email = "Enter a valid email address, like name@example.com.";
    if (reg && !isPhone(d.phone)) er.phone = "Enter a valid phone number, like 0788 123 456.";
    if (!d.pw) er.pw = "Enter your password.";
    else if (d.pw.length < 8) er.pw = "Use at least 8 characters.";
    if (reg && !er.pw && d.pw !== d.pw2) er.pw2 = "The two passwords do not match.";
    if (Object.keys(er).length) {
      setErr(er);
      requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setErr({}); setBusy(true);
    const r = await signIn({ email: d.email, name: d.name, phone: d.phone, pw: d.pw, register: reg });
    setBusy(false);
    if (!r.ok) { setErr({ form: r.error }); return; }
    onDone?.();
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <Chip on={!reg} onClick={() => switchTo(false)}>Sign in</Chip>
        <Chip on={reg} onClick={() => switchTo(true)}>Create account</Chip>
      </div>
      <form className="stack" noValidate onSubmit={submit} key={String(reg)}>
        {reg && <Field label="Full name" error={err.name}><Input name="name" maxLength={60} autoComplete="name" aria-invalid={!!err.name} onChange={clear("name")} /></Field>}
        <Field label="Email" error={err.email}><Input name="email" type="email" inputMode="email" maxLength={120} autoComplete={reg ? "email" : "username"} aria-invalid={!!err.email} onChange={clear("email")} /></Field>
        {reg && <Field label="Phone number" error={err.phone}><Input name="phone" type="tel" inputMode="tel" maxLength={20} placeholder="07XX XXX XXX" autoComplete="tel" aria-invalid={!!err.phone} onChange={clear("phone")} /></Field>}
        <Field label="Password" error={err.pw} hint={reg ? "At least 8 characters." : undefined}>
          <Input name="pw" type={show ? "text" : "password"} maxLength={100} autoComplete={reg ? "new-password" : "current-password"} aria-invalid={!!err.pw} onChange={clear("pw")} />
        </Field>
        {reg && <Field label="Confirm password" error={err.pw2}><Input name="pw2" type={show ? "text" : "password"} maxLength={100} autoComplete="new-password" aria-invalid={!!err.pw2} onChange={clear("pw2")} /></Field>}
        <label className="fchk"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show password</span></label>
        {err.form && <div className="pf-err" role="alert">{err.form}</div>}
        <Button block disabled={busy}>{busy ? "Please wait..." : reg ? "Create account" : "Sign in"}</Button>
      </form>
    </>
  );
}

export default function Login() {
  const nav = useNavigate();
  const { user, site } = useStore();
  if (user) return <Navigate to="/account" replace />;
  return (
    <section style={{ paddingTop: 56 }}><div className="wrap" style={{ maxWidth: 440 }}>
      <h1 className="h2" style={{ marginBottom: 24 }}>Welcome to {site.short}</h1>
      <AuthBox onDone={() => nav("/account")} />
    </div></section>
  );
}
