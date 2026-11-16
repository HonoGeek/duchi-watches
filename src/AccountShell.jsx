import { useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "./store";
import { Icon, useMenu } from "./ui";
import { AIcon, Avatar, ThemeBtn, useOutside } from "./AdminShell";

/* The customer dashboard. It has its own layout (menu on the left, top bar above the page) instead of sitting
   inside the shop's header and footer, and shares its look with the admin area. */
const ITEMS = [["", "Overview", "grid"], ["orders", "Orders", "bag"], ["wishlist", "Wishlist", "heart"], ["addresses", "Addresses", "pin"], ["profile", "Profile", "user"]];
const LABELS = Object.fromEntries(ITEMS.map(([p, l]) => [p, l]));

function Crumbs() {
  const { pathname } = useLocation();
  const parts = pathname.replace(/^\/account\/?/, "").split("/").filter(Boolean);
  const sec = parts[0] || "";
  return (
    <nav className="ax-crumbs" aria-label="Breadcrumb">
      <Link to="/account">My account</Link><i>/</i>
      {parts[1]
        ? <><Link to={`/account/${sec}`}>{LABELS[sec] || sec}</Link><i>/</i><span aria-current="page">{decodeURIComponent(parts[1])}</span></>
        : <span aria-current="page">{LABELS[sec] || "Overview"}</span>}
    </nav>
  );
}

function Menu() {
  const { user, signOut } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = () => setOpen(false);
  useOutside(ref, close);
  return (
    <div className="ax-dd" ref={ref}>
      <button type="button" className="ax-um" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={user.name} size={34} />
        <span className="ax-un"><b>{user.name}</b><small>Customer</small></span>
        <span className="ax-chev">{AIcon.down}</span>
      </button>
      {open && (
        <div className="ax-pop ax-pop-u" role="menu">
          <div className="ax-pu"><Avatar name={user.name} size={44} /><div><b>{user.name}</b><small>{user.email}</small></div></div>
          <Link to="/account/profile" className="ax-pi" role="menuitem" onClick={close}><span className="ax-pic">{AIcon.user}</span><span>Profile</span></Link>
          <Link to="/account/orders" className="ax-pi" role="menuitem" onClick={close}><span className="ax-pic">{AIcon.bag}</span><span>My orders</span></Link>
          <Link to="/" className="ax-pi" role="menuitem" onClick={close}><span className="ax-pic">{AIcon.store}</span><span>Back to the store</span></Link>
          <button type="button" className="ax-pi" role="menuitem" onClick={() => { close(); signOut(); nav("/"); }}><span className="ax-pic">{AIcon.out}</span><span>Sign out</span></button>
        </div>
      )}
    </div>
  );
}

export default function AccountShell() {
  const { user, orders, cartCount, axCol, setAxCol, signOut } = useStore();
  const [open, setOpen] = useMenu(); // slide-in drawer on phones
  const nav = useNavigate();
  const onTheWay = useMemo(() => orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status)).length, [orders]);
  const badge = { orders: onTheWay };
  return (
    <div className={`ax${axCol ? " col" : ""}${open ? " open" : ""}`}>
      <div className="ax-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="ax-side" aria-label="Account menu">
        <div className="ax-brand">
          <Link to="/account" className="ax-logo" aria-label="My account">
            <span className="ax-mark">D</span>
            <span className="ax-name">DUCHI<i>.</i><small>Account</small></span>
          </Link>
          <button type="button" className="ax-fold" onClick={() => setAxCol(!axCol)} aria-pressed={axCol}
            aria-label={axCol ? "Expand the menu" : "Collapse the menu"} title={axCol ? "Expand menu" : "Collapse menu"}>{AIcon.fold}</button>
        </div>
        <nav className="ax-nav">
          <div className="ax-grp">
            <div className="ax-gl">Account</div>
            {ITEMS.map(([p, l, ic]) => (
              <NavLink key={p} to={`/account${p ? "/" + p : ""}`} end={!p} className="ax-a" title={axCol ? l : undefined}>
                <span className="ax-ic">{AIcon[ic]}</span><span className="ax-lb">{l}</span>
                {badge[p] > 0 && <b className="ax-ct">{badge[p]}</b>}
              </NavLink>
            ))}
          </div>
          <div className="ax-grp">
            <div className="ax-gl">Shop</div>
            <Link to="/shop" className="ax-a" title={axCol ? "Browse watches" : undefined}><span className="ax-ic">{AIcon.box}</span><span className="ax-lb">Browse watches</span></Link>
            <Link to="/cart" className="ax-a" title={axCol ? "Cart" : undefined}><span className="ax-ic">{AIcon.bag}</span><span className="ax-lb">Cart</span>{cartCount > 0 && <b className="ax-ct">{cartCount}</b>}</Link>
            <Link to="/contact" className="ax-a" title={axCol ? "Help" : undefined}><span className="ax-ic">{Icon.chat}</span><span className="ax-lb">Help and contact</span></Link>
          </div>
        </nav>
        <div className="ax-foot">
          <button type="button" className="ax-user ax-userbtn" onClick={() => { signOut(); nav("/"); }} title={axCol ? "Sign out" : undefined}>
            <span className="ax-pic" style={{ background: "transparent" }}>{AIcon.out}</span>
            <span className="ax-ul"><b>Sign out</b><small>{user.email}</small></span>
          </button>
        </div>
      </aside>
      <div className="ax-body">
        <header className="ax-top">
          <button type="button" className="ax-btn ax-burger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close the menu" : "Open the menu"}>{Icon.menu}</button>
          <Crumbs />
          <div className="ax-tools">
            <Link className="ax-view" to="/">{AIcon.store}<span>Back to store</span></Link>
            <Link className="ax-btn" to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}>{AIcon.bag}{cartCount > 0 && <b className="ax-dot">{cartCount}</b>}</Link>
            <ThemeBtn />
            <Menu />
          </div>
        </header>
        <main id="ax-main" className="ax-content"><Outlet /></main>
      </div>
    </div>
  );
}
