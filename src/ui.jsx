import { Children, cloneElement, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { photo, fmt } from "./lib";
import { useStore } from "./store";

/* ---------- reusable building blocks ---------- */
export const Img = ({ id, alt = "", w = 800, ...rest }) => (id ? (
  <img alt={alt} loading="lazy" src={photo(id, w)} onError={(e) => e.currentTarget.removeAttribute("src")} {...rest} />
) : null);

export function Button({ variant = "p", size, block, to, href, className = "", children, ...rest }) {
  const c = `btn btn-${variant}${size === "s" ? " btn-s" : ""}${block ? " btn-b" : ""} ${className}`.trim();
  if (href) return <a href={href} className={c} {...rest}>{children}</a>;
  return to ? <Link to={to} className={c} {...rest}>{children}</Link> : <button className={c} {...rest}>{children}</button>;
}
export const Field = ({ label, children }) => <label className="f">{label}{children}</label>;
export const Input = ({ className = "", ...p }) => <input className={`input ${className}`.trim()} {...p} />;
export const Select = ({ children, className = "", ...p }) => <select className={`input ${className}`.trim()} {...p}>{children}</select>;
export const Textarea = (p) => <textarea className="input" {...p} />;
export const Chip = ({ on, ...p }) => <button type="button" className={`chip${on ? " on" : ""}`} {...p} />;
export const Panel = ({ className = "", ...p }) => <div className={`panel ${className}`} {...p} />;
export const Badge = ({ children, soft }) => (
  <span className="badge" style={soft ? { background: "var(--soft)" } : undefined}>{children}</span>
);
export const Empty = ({ text, to = "/shop", label = "Browse watches" }) => (
  <Panel><p className="mute" style={{ marginBottom: 16 }}>{text}</p><Button to={to}>{label}</Button></Panel>
);
export const Table = ({ head, children }) => (
  <div className="tw"><table className="tbl"><thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{Children.map(children, (tr) => tr && cloneElement(tr, {}, Children.map(tr.props.children, (td, i) => td && cloneElement(td, { "data-label": head[i] || "" }))))}</tbody></table></div>
);

export function Qty({ value, onMinus, onPlus }) {
  return (
    <div className="qty">
      <button type="button" onClick={onMinus} aria-label="Less">−</button>
      <span>{value}</span>
      <button type="button" onClick={onPlus} aria-label="More">+</button>
    </div>
  );
}

export function Heart({ id, page }) {
  const { wish, toggleWish } = useStore();
  const on = wish.includes(id);
  return (
    <button type="button" className={`heart${page ? " pg" : ""}${on ? " on" : ""}`} onClick={() => toggleWish(id)}
      aria-label="Save to wishlist" aria-pressed={on}>
      <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
    </button>
  );
}

/* Open/close state for a phone menu: closes on navigation and Escape, locks page scroll while open. */
export function useMenu() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  return [open, setOpen];
}

/* Hamburger that turns into an X while the menu is open. */
export const MenuButton = ({ open, onClick, label = "menu", controls }) => (
  <button type="button" className={`ib menu${open ? " x" : ""}`} onClick={onClick}
    aria-label={`${open ? "Close" : "Open"} ${label}`} aria-expanded={open} aria-controls={controls}>
    <span className="hb"><i /><i /><i /></span>
  </button>
);

/* Fades/slides content in when it scrolls into view. */
export function Reveal({ as: Tag = "div", d = 0, className = "", style, children, ...rest }) {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`rv${on ? " in" : ""} ${className}`.trim()} style={{ "--d": `${d}ms`, ...style }} {...rest}>{children}</Tag>;
}

/* Horizontal carousel controls for any scroll-snap row.
   const { ref, go, canPrev, canNext, onKeyDown } = useCarousel(dep);
   Put ref on the scrolling element, call go(-1) / go(1) from the arrows and use canPrev / canNext to disable them.
   Touch, trackpad and keyboard scrolling keep working because the row is still native overflow scrolling. */
export function useCarousel(dep) {
  const ref = useRef(null);
  const [can, setCan] = useState({ prev: false, next: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const prev = el.scrollLeft > 4, next = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
    setCan((c) => (c.prev === prev && c.next === next ? c : { prev, next }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); ro?.disconnect(); };
  }, [update, dep]);
  const go = (d) => {
    const el = ref.current;
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: calm ? "auto" : "smooth" });
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };
  return { ref, go, canPrev: can.prev, canNext: can.next, onKeyDown };
}

export const Stars = ({ n }) => (
  <div className="st" role="img" aria-label={`${n} out of 5 stars`}>
    {[0, 1, 2, 3, 4].map((k) => (
      <svg key={k} viewBox="0 0 24 24" className={k < n ? "f" : ""} style={{ "--k": k }}>
        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
      </svg>
    ))}
  </div>
);

/* ---------- pagination ---------- */
// usePaged(list, size, resetKey): returns the items of the current page. The page goes back to 1 when resetKey changes
// (for example when a filter changes) and is kept inside the available pages when the list gets shorter.
export function usePaged(list, size = 10, resetKey = "") {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey, size]);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(page, pages);
  return { items: list.slice((cur - 1) * size, cur * size), page: cur, pages, total: list.length, size, setPage };
}

const pageList = (cur, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const s = new Set([1, 2, pages - 1, pages, cur - 1, cur, cur + 1]);
  const out = [];
  [...s].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b).forEach((n, i, a) => {
    if (i && n - a[i - 1] > 1) out.push("gap" + n);
    out.push(n);
  });
  return out;
};

// <Pager {...paged} onPage={...} /> goes right under the list. Hidden when everything fits on one page.
export function Pager({ page, pages, total, size, onPage, noun = "items" }) {
  const ref = useRef(null);
  if (pages <= 1) return null;
  const go = (n) => {
    if (n < 1 || n > pages || n === page) return;
    onPage(n);
    requestAnimationFrame(() => ref.current?.previousElementSibling?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const from = (page - 1) * size + 1, to = Math.min(total, page * size);
  return (
    <nav className="pgr" ref={ref} aria-label="Pagination">
      <span className="pgr-info">Showing {from} to {to} of {total} {noun}</span>
      <div className="pgr-nav">
        <button type="button" className="pgr-b" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page">{Icon.left}</button>
        {pageList(page, pages).map((n) => (typeof n === "string"
          ? <span key={n} className="pgr-gap" aria-hidden="true">...</span>
          : <button key={n} type="button" className={`pgr-n${n === page ? " on" : ""}`} aria-current={n === page ? "page" : undefined} aria-label={`Page ${n}`} onClick={() => go(n)}>{n}</button>))}
        <button type="button" className="pgr-b" disabled={page >= pages} onClick={() => go(page + 1)} aria-label="Next page">{Icon.right}</button>
      </div>
    </nav>
  );
}

/* Shows how many of a product are left in stock (used in the cart and at checkout). */
export function StockLeft({ p, q = 0 }) {
  if (p.stock <= 0) return <span className="stk out">Sold out</span>;
  if (q > p.stock) return <span className="stk out">Only {p.stock} left in stock, please lower the quantity</span>;
  return <span className={`stk${p.stock <= 5 ? " low" : ""}`}>{p.stock <= 5 ? `Only ${p.stock} left in stock` : `${p.stock} in stock`}</span>;
}

export function ProductCard({ p, view = "grid" }) {
  const list = view === "list";
  const { reviewStats } = useStore();
  const rs = reviewStats[p.id];
  return (
    <div className={`card${list ? " list" : ""}`}>
      <div className="ph">
        <Link className="cl" to={`/product/${p.id}`} aria-label={p.n}><Img id={p.im[0]} alt={p.n} w={700} />{p.im[1] && <Img id={p.im[1]} alt="" w={700} className="alt2" aria-hidden="true" />}</Link>
        {p.stock <= 0 ? <span className="badge">Sold out</span> : p.tag ? <span className="badge">{p.tag}</span> : null}
        <Heart id={p.id} />
      </div>
      <Link to={`/product/${p.id}`}>
        <h3>{p.n}</h3>
        <div className="mute sm">{p.s}</div>
        {rs && <div className="crat" aria-label={`Rated ${rs.avg.toFixed(1)} out of 5 from ${rs.count} reviews`}><Stars n={Math.round(rs.avg)} /><span>{rs.avg.toFixed(1)} ({rs.count})</span></div>}
        {list && <div className="mute sm cat">{p.c}{p.spec?.movement ? ` · ${p.spec.movement}` : ""}</div>}
        <div className="price">{fmt(p.p)}</div>
        {p.stock > 0 && (list || p.stock <= 5) && <StockLeft p={p} />}
      </Link>
    </div>
  );
}

const SUBS_KEY = "duchi-subscribers";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Newsletter sign-up. Validates the address, rejects duplicates and confirms in words.
// The address is kept in this browser only. Connect a mailing service where the comment below says so to reach real subscribers.
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [st, setSt] = useState({ kind: "idle", msg: "" }); // idle | error | done
  const { showToast } = useStore();
  const fail = (msg) => setSt({ kind: "error", msg });
  const submit = (e) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!v) return fail("Enter your email address.");
    if (!EMAIL_RE.test(v)) return fail("That email address does not look right. Check it and try again.");
    let again = false;
    try {
      const list = JSON.parse(localStorage.getItem(SUBS_KEY) || "[]");
      again = list.includes(v);
      // To email real subscribers, send `v` to your mailing service here instead of (or as well as) this browser list.
      if (!again) localStorage.setItem(SUBS_KEY, JSON.stringify([...list, v]));
    } catch { return fail("We could not save your email. Please try again."); }
    setSt({ kind: "done", msg: again ? "You are already on the list. Thank you!" : "You are on the list. Thank you!" });
    showToast(again ? "You are already on the list" : "You are on the list. Thank you!");
  };
  return (
    <section className="alt news">
      <div className="wrap">
        <h2 className="h2">Stay Ahead of Time.</h2>
        <p className="sub" style={{ margin: "14px auto 0" }}>Be the first to discover new arrivals, exclusive offers, and the latest additions to our collection. Get the latest from DUCHI, delivered straight to your inbox.</p>
        {st.kind !== "done" && (
          <form noValidate onSubmit={submit}>
            <Input type="email" name="email" inputMode="email" autoComplete="email" placeholder="Your email address" aria-label="Email address"
              value={email} onChange={(e) => { setEmail(e.target.value); if (st.kind === "error") setSt({ kind: "idle", msg: "" }); }}
              aria-invalid={st.kind === "error"} aria-describedby="news-msg" />
            <Button type="submit">Join the List</Button>
          </form>
        )}
        <p id="news-msg" className={`news-msg${st.kind === "error" ? " err" : ""}${st.kind === "done" ? " ok" : ""}`} role="status" aria-live="polite">{st.msg}</p>
      </div>
    </section>
  );
}

const ic = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
export const Icon = {
  menu: <svg viewBox="0 0 24 24" {...ic}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
  moon: <svg viewBox="0 0 24 24" {...ic}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  sun: <svg viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>,
  user: <svg viewBox="0 0 24 24" {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  bag: <svg viewBox="0 0 24 24" {...ic}><path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0" /></svg>,
  instagram: <svg viewBox="0 0 24 24" {...ic}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r=".6" /></svg>,
  tiktok: <svg viewBox="0 0 24 24" {...ic}><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.3 2.4 2 4 4.5 4.2" /></svg>,
  facebook: <svg viewBox="0 0 24 24" {...ic}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /></svg>,
  x: <svg viewBox="0 0 24 24" {...ic}><path d="M4 4l16 16M20 4L4 20" /></svg>,
  truck: <svg viewBox="0 0 24 24" {...ic}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>,
  card: <svg viewBox="0 0 24 24" {...ic}><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>,
  shield: <svg viewBox="0 0 24 24" {...ic}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>,
  chat: <svg viewBox="0 0 24 24" {...ic}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg>,
  check: <svg viewBox="0 0 24 24" className="ok2" {...ic}><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  cross: <svg viewBox="0 0 24 24" {...ic}><path d="M7 7l10 10M17 7L7 17" /></svg>,
  left: <svg viewBox="0 0 24 24" {...ic}><path d="M15 5l-7 7 7 7" /></svg>,
  right: <svg viewBox="0 0 24 24" {...ic}><path d="M9 5l7 7-7 7" /></svg>,
  returns: <svg viewBox="0 0 24 24" {...ic}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>,
  pin: <svg viewBox="0 0 24 24" {...ic}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" {...ic}><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 9c0 3 3 6 6 6l1-2-2-1-1 .5c-1-.5-1.5-1-2-2l.5-1-1-2z" /></svg>,
};
