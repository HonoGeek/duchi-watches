import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useStore } from "./store";
import { Icon, Button, MenuButton, useMenu } from "./ui";
import { fmt } from "./lib";

export function Topbar() {
  const { zones } = useStore();
  return <div className="top">Delivery across Rwanda: {zones.map((z) => `${z.name} ${fmt(z.fee)}`).join(", ")}.</div>;
}

export function Header() {
  const { theme, setTheme, cartCount } = useStore();
  const [open, setOpen] = useMenu();
  const [sc, setSc] = useState(false);
  useEffect(() => {
    const on = () => setSc(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const close = () => setOpen(false);
  return (
    <>
    <div className={`scrim${open ? " show" : ""}`} onClick={close} aria-hidden="true" />
    <header className={`${sc ? "scrolled" : ""}${open ? " mopen" : ""}`.trim()}>
      <div className="wrap nav">
        <MenuButton open={open} onClick={() => setOpen((o) => !o)} label="menu" controls="mnav" />
        <Link className="logo" to="/">DUCHI<i>.</i></Link>
        <nav id="mnav" className={`links${open ? " open" : ""}`}>
          <NavLink to="/" end onClick={close} style={{ "--i": 0 }}>Home</NavLink>
          <NavLink to="/shop" onClick={close} style={{ "--i": 1 }}>Shop</NavLink>
          <NavLink to="/contact" onClick={close} style={{ "--i": 2 }}>Contact</NavLink>
          <NavLink to="/account" onClick={close} style={{ "--i": 3 }} className="only-m">My account</NavLink>
        </nav>
        <div className="row" style={{ gap: 2 }}>
          <button className="ib" onClick={setTheme} aria-label="Switch light or dark mode">{theme === "dark" ? Icon.sun : Icon.moon}</button>
          <Link className="ib" to="/account" aria-label="Account">{Icon.user}</Link>
          <Link className="ib" to="/cart" aria-label="Cart">{Icon.bag}<span className="cnt" key={cartCount}>{cartCount}</span></Link>
        </div>
      </div>
    </header>
    </>
  );
}

export function Footer() {
  const social = [["Instagram", "instagram"], ["TikTok", "tiktok"], ["Facebook", "facebook"], ["X", "x"], ["WhatsApp", "whatsapp"]];
  return (
    <footer>
      <div className="wrap">
        <div className="fc">
          <div>
            <div className="logo" style={{ color: "var(--ink)" }}>DUCHI<i>.</i></div>
            <p style={{ marginTop: 10, maxWidth: 280 }}>Quality watches, checked by our team and delivered across Rwanda.</p>
            <div className="soc">
              {social.map(([n, k]) => <a key={k} href="#" aria-label={n} onClick={(e) => e.preventDefault()}>{Icon[k]}</a>)}
            </div>
          </div>
          <div><h4>Shop</h4><Link to="/shop">All watches</Link><Link to="/account">My account</Link><Link to="/cart">Cart</Link><Link to="/checkout">Checkout</Link></div>
          <div><h4>Help</h4><Link to="/contact">Contact us</Link><a href="#" onClick={(e) => e.preventDefault()}>Delivery</a><a href="#" onClick={(e) => e.preventDefault()}>Returns</a></div>
          <div><h4>Legal</h4><a href="#" onClick={(e) => e.preventDefault()}>Terms</a><a href="#" onClick={(e) => e.preventDefault()}>Privacy</a><a href="#" onClick={(e) => e.preventDefault()}>Warranty</a><Link to="/admin">Staff login</Link></div>
        </div>
        <p>© 2026 DUCHI STORE, Kigali, Rwanda.</p>
      </div>
    </footer>
  );
}

export function Toast() {
  const { toast, hideToast } = useStore();
  return (
    <div className={`toast${toast ? " show" : ""}${toast?.type === "err" ? " err" : ""}`} role="status" aria-live="polite">
      {toast && <>
        <i className="tic" aria-hidden="true">
          {toast.type === "err"
            ? <svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.01" /><circle cx="12" cy="12" r="9" /></svg>
            : <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
        </i>
        <span>{toast.msg}</span>
        {toast.to && <Button to={toast.to} variant="g" size="s">{toast.label || "View"}</Button>}
        {toast.action && <Button type="button" variant="g" size="s" onClick={toast.action}>{toast.label || "Undo"}</Button>}
        <button type="button" className="tx" onClick={hideToast} aria-label="Dismiss message"><svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17" /></svg></button>
      </>}
    </div>
  );
}

export const WhatsApp = () => (
  <a className="btn btn-g wa" href="#" aria-label="WhatsApp us" onClick={(e) => e.preventDefault()}>
    <span className="t">WhatsApp us</span>{Icon.whatsapp}
  </a>
);
