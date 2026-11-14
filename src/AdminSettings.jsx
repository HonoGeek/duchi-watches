import { useRef, useState } from "react";
import { useStore } from "./store";
import { Button, Field, Input } from "./ui";
import { Avatar, Card, PageHead } from "./AdminShell";
import { readImage, tm } from "./lib";

const strength = (p) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
};
const LEVEL = ["Too short", "Weak", "Fair", "Good", "Strong"];

export default function AdminSettings() {
  const { adm, me, audit, updateAdminProfile, changeAdminPassword, theme, setTheme, axCol, setAxCol, showToast } = useStore();
  const [f, setF] = useState({ name: adm.name, email: adm.email, phone: me?.phone || "", avatar: me?.avatar || "" });
  const [pw, setPw] = useState({ cur: "", nw: "", again: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const dirty = f.name !== adm.name || f.email !== adm.email || f.phone !== (me?.phone || "") || f.avatar !== (me?.avatar || "");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const lastIn = audit.filter((a) => a.w === adm.email && a.m === "Signed in")[1]; // [0] is this session

  const pickPhoto = async (e) => {
    const fl = e.target.files?.[0];
    e.target.value = "";
    if (!fl) return;
    if (!fl.type.startsWith("image/")) { showToast("Please choose an image file"); return; }
    try { setF((x) => ({ ...x, avatar: "" })); const a = await readImage(fl, 256, 0.85); setF((x) => ({ ...x, avatar: a })); }
    catch { showToast("Could not read that photo. Try a JPG or PNG."); }
  };
  const saveProfile = (e) => { e.preventDefault(); updateAdminProfile(f); };
  const lvl = strength(pw.nw);
  const mismatch = pw.again && pw.nw !== pw.again;
  const savePw = async (e) => {
    e.preventDefault();
    if (pw.nw !== pw.again) { showToast("The new passwords do not match"); return; }
    if (pw.nw === pw.cur) { showToast("Please choose a password you have not used before"); return; }
    setBusy(true);
    const ok = await changeAdminPassword(pw.cur, pw.nw);
    setBusy(false);
    if (ok) setPw({ cur: "", nw: "", again: "" });
  };

  return (
    <div className="sx">
      <PageHead title="Settings" sub="Your own account: how you appear to the team, how you sign in and how the admin area looks for you." />

      {me && !me.pwh && (
        <div className="sx-warn" role="note">
          <b>You are using the shared demo password.</b> Choose your own password below so only you can sign in as {adm.name}.
        </div>
      )}

      <Card title="Profile" sub="Your name and photo show in the top bar and in the audit log.">
        <form className="stack" onSubmit={saveProfile}>
          <div className="sx-av">
            <Avatar name={f.name || "?"} src={f.avatar} size={84} />
            <div>
              <div className="row">
                <label className="btn btn-o btn-s upl">Upload photo<input ref={file} type="file" accept="image/*" aria-label="Upload a profile photo" onChange={pickPhoto} /></label>
                {f.avatar && <Button type="button" variant="o" size="s" onClick={() => setF((x) => ({ ...x, avatar: "" }))}>Remove</Button>}
              </div>
              <p className="mute sm" style={{ marginTop: 8 }}>JPG or PNG. It is resized to a small square.</p>
            </div>
          </div>
          <div className="two">
            <Field label="Full name"><Input required value={f.name} onChange={set("name")} autoComplete="name" /></Field>
            <Field label="Phone (optional)"><Input type="tel" value={f.phone} onChange={set("phone")} placeholder="07XX XXX XXX" autoComplete="tel" /></Field>
          </div>
          <Field label="Email (you sign in with this)"><Input required type="email" value={f.email} onChange={set("email")} autoComplete="email" /></Field>
          <div className="sx-meta">
            <span>Role <b className="pill off">{adm.role}</b></span>
            {lastIn && <span className="mute sm">Previous sign in: {tm(lastIn.t)}</span>}
          </div>
          <div className="row">
            <Button disabled={!dirty}>Save changes</Button>
            {dirty && <Button type="button" variant="o" onClick={() => setF({ name: adm.name, email: adm.email, phone: me?.phone || "", avatar: me?.avatar || "" })}>Discard</Button>}
          </div>
        </form>
      </Card>

      <Card title="Password" sub="Use at least 8 characters. A mix of letters, numbers and symbols is stronger.">
        <form className="stack" onSubmit={savePw}>
          <Field label="Current password"><Input type={show ? "text" : "password"} required value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" /></Field>
          <div className="two">
            <div>
              <Field label="New password"><Input type={show ? "text" : "password"} required minLength={8} value={pw.nw} onChange={(e) => setPw({ ...pw, nw: e.target.value })} autoComplete="new-password" /></Field>
              {pw.nw && (
                <div className="sx-meter" aria-live="polite">
                  <div>{[1, 2, 3, 4].map((n) => <i key={n} className={n <= lvl ? `on l${lvl}` : ""} />)}</div>
                  <span>{LEVEL[lvl]}</span>
                </div>
              )}
            </div>
            <Field label="Confirm new password">
              <Input type={show ? "text" : "password"} required value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} autoComplete="new-password" aria-invalid={!!mismatch} />
              {mismatch && <span className="fhint" style={{ color: "#d93025" }}>The passwords do not match yet</span>}
            </Field>
          </div>
          <label className="fchk"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show passwords</span></label>
          <div><Button disabled={busy || !pw.cur || pw.nw.length < 8 || pw.nw !== pw.again}>{busy ? "Saving..." : "Change password"}</Button></div>
        </form>
      </Card>

      <Card title="Appearance" sub="These choices are saved in this browser.">
        <div className="sx-pref">
          <div><b>Theme</b><p className="mute sm">Light or dark, for the shop and the admin area.</p></div>
          <div className="vmode" role="group" aria-label="Theme">
            {["light", "dark"].map((t) => <button key={t} type="button" className={theme === t ? "on" : ""} aria-pressed={theme === t} onClick={() => theme !== t && setTheme()}>{t === "light" ? "Light" : "Dark"}</button>)}
          </div>
        </div>
        <div className="sx-pref">
          <div><b>Compact menu</b><p className="mute sm">Show only icons in the side menu to give pages more room.</p></div>
          <label className="fchk"><input type="checkbox" checked={axCol} onChange={(e) => setAxCol(e.target.checked)} aria-label="Compact menu" /><span>{axCol ? "On" : "Off"}</span></label>
        </div>
      </Card>
    </div>
  );
}
