import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "./store";
import { AIcon } from "./AdminShell";
import { ago } from "./lib";
import "./notif.css";

/* The customer's notification bell. It lists what happened to their orders (dispatched, delivered, cancelled, payment)
   and shows how many are not read yet. variant "shop" fits the shop header, "ax" fits the account dashboard top bar. */
const KIND = {
  dispatched: AIcon.truck, delivered: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  cancelled: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>,
  paid: AIcon.card, failed: AIcon.card, processing: AIcon.bag,
  approved: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>, declined: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>, refunded: AIcon.card,
};

export default function NotifBell({ variant = "ax" }) {
  const { myNotifs, readNotif, readAllNotifs } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const btn = useRef(null), pop = useRef(null);
  const [pos, setPos] = useState(null); // where the list sits under the bell on a computer; on a phone it is a sheet at the bottom
  const close = () => setOpen(false);
  // The list is drawn on the page body, not inside the top bar: a bar with a blurred background would otherwise
  // trap "fixed" positioning and push the sheet off the screen on phones.
  const toggle = () => {
    if (!open) {
      const r = btn.current.getBoundingClientRect();
      setPos(innerWidth > 600 ? { top: r.bottom + 10, right: Math.max(12, innerWidth - r.right) } : null);
    }
    setOpen((o) => !o);
  };
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) close(); };
    const key = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    addEventListener("scroll", close, { passive: true });
    addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); removeEventListener("scroll", close); removeEventListener("resize", close); };
  }, [open]);
  const unread = myNotifs.filter((n) => !n.read).length;
  const list = myNotifs.slice(0, 8);
  const go = (n) => { readNotif(n.id); close(); nav(`/account/orders/${n.orderId}`); };
  return (
    <div className="nb">
      <button type="button" ref={btn} className={variant === "shop" ? "ib" : "ax-btn"} onClick={toggle} aria-expanded={open} aria-haspopup="menu"
        aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}>
        {AIcon.bell}{unread > 0 && <b className="nb-dot">{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && createPortal(
        <div className="nb-pop" role="menu" aria-label="Notifications" ref={pop} style={pos || undefined}>
          <span className="nb-grab" aria-hidden="true" />
          <div className="nb-h">
            <b>Notifications</b>
            {unread > 0 && <button type="button" className="lnk" onClick={readAllNotifs}>Mark all as read</button>}
          </div>
          {list.length ? (
            <ul>
              {list.map((n) => (
                <li key={n.id}>
                  <button type="button" role="menuitem" className={`nb-i${n.read ? "" : " new"}`} onClick={() => go(n)}>
                    <span className={`nb-ic k-${n.kind}`}>{KIND[n.kind] || AIcon.bell}</span>
                    <span className="nb-t"><b>{n.title}</b><span>{n.text}</span><small>{ago(n.date)}</small></span>
                    {!n.read && <i className="nb-u" aria-label="Not read yet" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="nb-e">Nothing yet. We will tell you here when your order is dispatched, delivered or cancelled.</p>}
          <Link className="nb-f" to="/account/orders" onClick={close}>View all my orders</Link>
        </div>,
        document.body
      )}
    </div>
  );
}
