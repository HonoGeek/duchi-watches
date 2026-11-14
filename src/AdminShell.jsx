import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useStore } from "./store";
import { Icon, useMenu } from "./ui";
import { PERM } from "./data";

/* ---------- icons (one consistent set for the whole admin area) ---------- */
const I = (d) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
export const AIcon = {
  grid: I(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>),
  bag: I(<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0" />),
  box: I(<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />),
  tag: I(<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></>),
  star: I(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />),
  ticket: I(<path d="M3 9a2 2 0 0 0 0 6v2h18v-2a2 2 0 0 1 0-6V7H3zM14 7v10" />),
  truck: I(<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>),
  play: I(<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></>),
  card: I(<><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M7 15h4" /></>),
  users: I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  list: I(<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />),
  cog: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  bell: I(<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />),
  store: I(<path d="M4 9l1.5-5h13L20 9v11H4zM4 9h16M9 20v-6h6v6" />),
  out: I(<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />),
  fold: I(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></>),
  down: I(<path d="M6 9l6 6 6-6" />),
};

// [path, label, icon]. Each role only sees the pages listed for it in PERM (data.js).
const GROUPS = [
  ["Overview", [["", "Dashboard", "grid"]]],
  ["Store", [["orders", "Orders", "bag"], ["products", "Products", "box"], ["categories", "Categories", "tag"], ["reviews", "Reviews", "star"], ["coupons", "Coupons", "ticket"], ["shipping", "Shipping", "truck"]]],
  ["Content", [["videos", "Videos", "play"]]],
  ["System", [["payments", "Payments", "card"], ["team", "Team and roles", "users"], ["audit", "Audit log", "list"], ["settings", "Settings", "cog"]]],
];
const LABELS = Object.fromEntries(GROUPS.flatMap(([, l]) => l.map(([p, n]) => [p, n])));

/* ---------- small shared pieces used by every admin page ---------- */
export const PageHead = ({ title, sub, actions }) => (
  <div className="ax-ph">
    <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
    {actions && <div className="ax-pa">{actions}</div>}
  </div>
);

// <Card title sub actions> wraps a block of content in the standard admin card.
export const Card = ({ title, sub, actions, className = "", children }) => (
  <section className={`panel ax-card ${className}`.trim()}>
    {(title || actions) && (
      <div className="ax-ch">
        <div>{title && <h2>{title}</h2>}{sub && <p>{sub}</p>}</div>
        {actions && <div className="ax-pa">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export function Avatar({ name = "?", src, size = 36 }) {
  return (
    <span className="ax-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : (name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function useOutside(ref, close) {
  useEffect(() => {
    const down = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const key = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [ref, close]);
}

function Crumbs() {
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  const sec = parts[0] || "";
  return (
    <nav className="ax-crumbs" aria-label="Breadcrumb">
      <Link to="/admin">Admin</Link><i>/</i>
      {parts[1]
        ? <><Link to={`/admin/${sec}`}>{LABELS[sec] || sec}</Link><i>/</i><span aria-current="page">{decodeURIComponent(parts[1])}</span></>
        : <span aria-current="page">{LABELS[sec] || "Dashboard"}</span>}
    </nav>
  );
}

function Bell({ counts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);
  useOutside(ref, close);
  const rows = [
    [counts.orders, "order", "waiting to be processed", "/admin/orders", AIcon.bag],
    [counts.low, "product", "low on stock (5 or fewer)", "/admin/products", AIcon.box],
    [counts.reviews, "review", "waiting for approval", "/admin/reviews", AIcon.star],
  ].filter(([n]) => n > 0);
  const total = rows.reduce((a, r) => a + r[0], 0);
  return (
    <div className="ax-dd" ref={ref}>
      <button type="button" className="ax-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications${total ? `, ${total} need attention` : ""}`}>
        {AIcon.bell}{total > 0 && <b className="ax-dot">{total > 9 ? "9+" : total}</b>}
      </button>
      {open && (
        <div className="ax-pop" role="menu">
          <div className="ax-poph">Needs your attention</div>
          {rows.length ? rows.map(([n, noun, tail, to, ic]) => (
            <Link key={to} to={to} className="ax-pi" role="menuitem" onClick={close}>
              <span className="ax-pic">{ic}</span>
              <span><b>{n} {noun}{n === 1 ? "" : "s"}</b> {tail}</span>
            </Link>
          )) : <p className="ax-pe">You are all caught up.</p>}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { adm, me, adminSignOut } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);
  useOutside(ref, close);
  return (
    <div className="ax-dd" ref={ref}>
      <button type="button" className="ax-um" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={adm.name} src={me?.avatar} size={34} />
        <span className="ax-un"><b>{adm.name}</b><small>{adm.role}</small></span>
        <span className="ax-chev">{AIcon.down}</span>
      </button>
      {open && (
        <div className="ax-pop ax-pop-u" role="menu">
          <div className="ax-pu">
            <Avatar name={adm.name} src={me?.avatar} size={44} />
            <div><b>{adm.name}</b><small>{adm.email}</small><span className="pill off">{adm.role}</span></div>
          </div>
          <Link to="/admin/settings" className="ax-pi" role="menuitem" onClick={close}><span className="ax-pic">{AIcon.cog}</span><span>Settings and password</span></Link>
          <a href="#/" target="_blank" rel="noopener" className="ax-pi" role="menuitem" onClick={close}><span className="ax-pic">{AIcon.store}</span><span>View store</span></a>
          <button type="button" className="ax-pi" role="menuitem" onClick={() => { close(); adminSignOut(); }}><span className="ax-pic">{AIcon.out}</span><span>Sign out</span></button>
        </div>
      )}
    </div>
  );
}

export function ThemeBtn() {
  const { theme, setTheme } = useStore();
  return (
    <button type="button" className="ax-btn" onClick={setTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
      {theme === "dark" ? Icon.sun : Icon.moon}
    </button>
  );
}

/* ---------- the shell: collapsible sidebar + top bar + page ---------- */
export default function AdminShell() {
  const { adm, me, allOrders, products, reviews, axCol, setAxCol } = useStore();
  const [open, setOpen] = useMenu(); // the sidebar becomes a slide-in drawer on phones
  const allowed = PERM[adm.role] || [];
  const counts = useMemo(() => ({
    orders: allOrders.filter((o) => o.status === "Processing").length,
    low: products.filter((p) => p.stock <= 5 && p.active !== false).length,
    reviews: (reviews || []).filter((r) => r.status === "pending").length,
  }), [allOrders, products, reviews]);
  const badge = { orders: counts.orders, reviews: counts.reviews };

  return (
    <div className={`ax${axCol ? " col" : ""}${open ? " open" : ""}`}>
      <div className="ax-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="ax-side" aria-label="Admin menu">
        <div className="ax-brand">
          <Link to="/admin" className="ax-logo" aria-label="DUCHI admin home">
            <span className="ax-mark">D</span>
            <span className="ax-name">DUCHI<i>.</i><small>Admin</small></span>
          </Link>
          <button type="button" className="ax-fold" onClick={() => setAxCol(!axCol)} aria-pressed={axCol}
            aria-label={axCol ? "Expand the menu" : "Collapse the menu"} title={axCol ? "Expand menu" : "Collapse menu"}>{AIcon.fold}</button>
        </div>
        <nav className="ax-nav">
          {GROUPS.map(([g, items]) => {
            const list = items.filter(([p]) => allowed.includes(p));
            if (!list.length) return null;
            return (
              <div className="ax-grp" key={g}>
                <div className="ax-gl">{g}</div>
                {list.map(([p, l, ic]) => (
                  <NavLink key={p} to={`/admin${p ? "/" + p : ""}`} end={!p} className="ax-a" title={axCol ? l : undefined}>
                    <span className="ax-ic">{AIcon[ic]}</span>
                    <span className="ax-lb">{l}</span>
                    {badge[p] > 0 && <b className="ax-ct">{badge[p]}</b>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="ax-foot">
          <Link to="/admin/settings" className="ax-user" title={axCol ? `${adm.name} (${adm.role})` : undefined}>
            <Avatar name={adm.name} src={me?.avatar} size={38} />
            <span className="ax-ul"><b>{adm.name}</b><small>{adm.role}</small></span>
          </Link>
        </div>
      </aside>

      <div className="ax-body">
        <header className="ax-top">
          <button type="button" className="ax-btn ax-burger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close the menu" : "Open the menu"}>{Icon.menu}</button>
          <Crumbs />
          <div className="ax-tools">
            <a className="ax-view" href="#/" target="_blank" rel="noopener">{AIcon.store}<span>View store</span></a>
            <Bell counts={counts} />
            <ThemeBtn />
            <UserMenu />
          </div>
        </header>
        <main id="ax-main" className="ax-content"><Outlet /></main>
      </div>
    </div>
  );
}
