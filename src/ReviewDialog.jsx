import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "./store";
import { Button, Field, Icon, Img, Textarea, Input } from "./ui";
import { REVIEW_MAX, REVIEW_MIN } from "./data";
import { MAX_IMAGE, readImage } from "./lib";

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const STAR = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";

// Five tappable stars. Works with the mouse, touch and the arrow keys.
export function StarPick({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const show = hover || value;
  const key = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
  };
  return (
    <div className="spick" role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)} onKeyDown={key}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1} className={n <= show ? "on" : ""}
          onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
          <svg viewBox="0 0 24 24"><path d={STAR} /></svg>
        </button>
      ))}
      <span className="spick-w" aria-live="polite">{WORDS[show] || "Tap a star"}</span>
    </div>
  );
}

// item = { key, pid, orderId } for a new review, or existing = the review being edited.
export default function ReviewDialog({ item, existing, onClose }) {
  const { products, user, addReview, updateReview, showToast } = useStore();
  const pid = existing ? existing.pid : item.pid;
  const p = products[pid];
  const parts = (user?.name || "").trim().split(/\s+/).filter(Boolean);
  const [r, setR] = useState(existing?.r || 0);
  const [t, setT] = useState(existing?.t || "");
  const [n, setN] = useState(existing?.n || (parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] || "Customer"));
  const [img, setImg] = useState(existing?.img || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef(null);

  useEffect(() => { // focus the dialog, close on Escape, and keep the page still behind it
    const before = document.activeElement;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; before?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const photo = async (e) => {
    const fl = e.target.files?.[0];
    e.target.value = "";
    if (!fl) return;
    if (!fl.type.startsWith("image/")) { showToast("Please choose an image file"); return; }
    if (fl.size > MAX_IMAGE) { showToast("That photo is too large. Please choose one under 15 MB."); return; }
    setBusy(true);
    try { setImg(await readImage(fl, 900, 0.8)); } catch { showToast("Could not read that photo. Try a JPG or PNG."); }
    setBusy(false);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!r) { setErr("Tap a star to rate the watch."); return; }
    if (t.trim().length < REVIEW_MIN) { setErr(`Please write at least ${REVIEW_MIN} characters so others know what you think.`); return; }
    if (!n.trim()) { setErr("Add the name to show with your review."); return; }
    const ok = existing
      ? (updateReview(existing.id, { r, t: t.trim(), n: n.trim(), img }), true)
      : addReview({ ...item, n: n.trim(), r, t: t.trim(), img });
    if (ok) onClose();
  };

  return (
    <div className="mdl" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="mdl-box" ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="rw-title" onSubmit={submit}>
        <button type="button" className="mdl-x" onClick={onClose} aria-label="Close">{Icon.cross}</button>
        <div className="rw-top">
          <div className="rw-th"><Img id={p.im[0]} w={160} /></div>
          <div><h2 id="rw-title">{existing ? "Edit your review" : "How do you like it?"}</h2><p className="mute">{p.n} <span className="rw-vb">Verified buyer</span></p></div>
        </div>
        <StarPick value={r} onChange={(v) => { setR(v); setErr(""); }} />
        <div>
          <Field label="Your review">
            <Textarea rows={4} maxLength={REVIEW_MAX} value={t} onChange={(e) => { setT(e.target.value); setErr(""); }} placeholder="What do you like? How does it fit and look? Would you recommend it?" />
          </Field>
          <div className="pf-cnt">{t.length} / {REVIEW_MAX}</div>
        </div>
        <div className="rw-ph">
          {img ? (
            <div className="rw-pv"><img src={img} alt="Your photo" /><button type="button" onClick={() => setImg("")} aria-label="Remove photo">{Icon.cross}</button></div>
          ) : null}
          <label className={`btn btn-o btn-s upl${busy ? " busy" : ""}`}>{busy ? "Preparing..." : img ? "Change photo" : "Add a photo (optional)"}
            <input type="file" accept="image/*" aria-label="Add a photo to your review" disabled={busy} onChange={photo} />
          </label>
        </div>
        <Field label="Name shown with your review"><Input value={n} maxLength={30} onChange={(e) => setN(e.target.value)} /></Field>
        {err && <div className="pf-err" role="alert">{err}</div>}
        <div className="row mdl-act">
          <Button type="button" variant="o" onClick={onClose}>Not now</Button>
          <Button>{existing ? "Save changes" : "Post review"}</Button>
        </div>
        <p className="mute sm">Reviews are public and show your name with a "Verified buyer" label. Only customers who received the watch can review it.</p>
      </form>
    </div>
  );
}

/* A friendly, optional invitation. It appears after an order is delivered, never blocks anything, and can be
   dismissed for now ("Not now") or for good ("Do not ask again"). */
export function ReviewNudge() {
  const { user, eligible, skipRev, skipReview, products } = useStore();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [later, setLater] = useState(false);
  const [open, setOpen] = useState(null);
  const item = user ? eligible.find((e) => !skipRev.includes(e.key)) : null;
  useEffect(() => {
    setReady(false);
    if (!item) return undefined;
    const t = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, [item?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (open) return <ReviewDialog item={open} onClose={() => setOpen(null)} />;
  if (!item || !ready || later || /^\/(checkout|success|login|cart|admin)/.test(pathname)) return null;
  const p = products[item.pid];
  return (
    <aside className="rnudge" aria-label="Review request">
      <div className="rn-th"><Img id={p.im[0]} w={120} /></div>
      <div className="rn-b">
        <b>Your {p.n} has arrived</b>
        <span>How do you like it? A quick review helps other buyers. It is completely optional.</span>
        <div className="row">
          <Button size="s" onClick={() => setOpen(item)}>Write a review</Button>
          <button type="button" className="lnk" onClick={() => setLater(true)}>Not now</button>
          <button type="button" className="lnk mute" onClick={() => skipReview(item.key)}>Do not ask again</button>
        </div>
      </div>
    </aside>
  );
}
