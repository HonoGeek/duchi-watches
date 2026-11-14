import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Badge, Empty, Field, Input, Pager, Panel, Select, ProductCard, Stars, MenuButton, useMenu, usePaged } from "../ui";
import ReviewDialog from "../ReviewDialog";
import { AuthBox } from "./Login";
import { fmt, dt } from "../lib";

// Rows per page in the customer area.
const PAGE_SIZE = { orders: 6, wishlist: 6 };

export default function Account() {
  const { user, signOut } = useStore();
  const { pathname } = useLocation();
  const [open, setOpen] = useMenu();
  if (!user) {
    return (
      <section style={{ paddingTop: 56 }}><div className="wrap" style={{ maxWidth: 440 }}>
        <h1 className="h2" style={{ marginBottom: 24 }}>Welcome to DUCHI</h1>
        <AuthBox />
      </div></section>
    );
  }
  const items = [["", "Overview"], ["orders", "Orders"], ["wishlist", "Wishlist"], ["addresses", "Addresses"], ["profile", "Profile"]];
  const cur = (items.find(([p]) => p && pathname.startsWith(`/account/${p}`)) || items[0])[1];
  const close = () => setOpen(false);
  return (
    <section className="dsec"><div className="wrap"><div className="dash">
      <div className={`scrim d${open ? " show" : ""}`} onClick={close} aria-hidden="true" />
      <div className="dside">
        <div className="dbar">
          <div><span className="mute sm">Account</span><b>{cur}</b></div>
          <MenuButton open={open} onClick={() => setOpen((o) => !o)} label="account menu" controls="dnav" />
        </div>
        <nav id="dnav" className={`dnav${open ? " open" : ""}`} aria-label="Account">
          {items.map(([p, l], i) => <NavLink key={p} to={`/account${p ? "/" + p : ""}`} end onClick={close} style={{ "--i": i }}>{l}</NavLink>)}
          <button className="out" onClick={() => { close(); signOut(); }} style={{ "--i": items.length }}>Sign out</button>
        </nav>
      </div>
      <div><Outlet /></div>
    </div></div></section>
  );
}

const OrderRow = ({ o }) => {
  const { eligible } = useStore();
  const n = o.items.reduce((a, x) => a + x.q, 0);
  const todo = eligible.filter((e) => e.orderId === o.id).length; // delivered items still waiting for a review
  return (
    <Link className="panel orow" to={`/account/orders/${o.id}`}>
      <div><b style={{ fontWeight: 500 }}>{o.id}</b><div className="mute sm">{dt(o.date)}, {n} item{n > 1 ? "s" : ""}</div>
        {todo > 0 && <span className="rw-chip">Rate your {todo === 1 ? "watch" : `${todo} watches`}</span>}</div>
      <Badge>{o.status}</Badge><b>{fmt(o.total)}</b>
    </Link>
  );
};

export function Overview() {
  const { user, orders, wish, addrs, eligible, products } = useStore();
  const stats = [["Orders", orders.length, "orders"], ["Wishlist", wish.length, "wishlist"], ["Saved addresses", addrs.length, "addresses"]];
  return (
    <>
      <h1 className="h2">Hi, {user.name.split(" ")[0]}</h1>
      <p className="mute" style={{ margin: "8px 0 28px" }}>{user.email}</p>
      <div className="stats">
        {stats.map(([l, n, to]) => <Link key={to} className="panel" to={`/account/${to}`}><div className="h2">{n}</div><div className="mute sm">{l}</div></Link>)}
      </div>
      {eligible.length > 0 && (
        <Panel className="rvcta">
          <div><b>{eligible.length === 1 ? `How do you like your ${products[eligible[0].pid].n}?` : `${eligible.length} delivered watches are waiting for your review`}</b>
            <p className="mute sm">A quick review helps other buyers. It is completely optional.</p></div>
          <Button size="s" to="/account/orders">Rate {eligible.length === 1 ? "it" : "them"}</Button>
        </Panel>
      )}
      <h2 className="h3" style={{ margin: "40px 0 16px" }}>Latest order</h2>
      {orders[0] ? <OrderRow o={orders[0]} /> : <Empty text="You have not placed an order yet." />}
    </>
  );
}

export function Orders() {
  const { orders } = useStore();
  const pg = usePaged(orders, PAGE_SIZE.orders);
  return (
    <>
      <h1 className="h2" style={{ marginBottom: 24 }}>Orders</h1>
      {orders.length ? <div>{pg.items.map((o) => <OrderRow key={o.id} o={o} />)}</div> : <Empty text="Your orders will appear here once you place one." />}
      <Pager {...pg} onPage={pg.setPage} noun="orders" />
    </>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { orders, products, cart, addToCart, showToast, reviews } = useStore();
  const [dlg, setDlg] = useState(null);
  const o = orders.find((x) => x.id === id);
  if (!o) return <Empty text="We could not find that order." to="/account/orders" label="Back to orders" />;
  const L = ["Placed", "Processing", "Dispatched", "Delivered"];
  const ix = Math.max(1, L.indexOf(o.status));
  const again = () => {
    const added = o.items.filter((it) => addToCart(it.id, it.q, { silent: true })).reduce((a, it) => a + it.q, 0);
    if (added) showToast(`${added} item${added > 1 ? "s" : ""} added to cart`, { to: "/cart", label: "View cart" });
  };
  return (
    <>
      <Link className="mute sm" to="/account/orders">Back to orders</Link>
      <h1 className="h2" style={{ margin: "8px 0 4px" }}>{o.id}</h1>
      <p className="mute" style={{ marginBottom: 24 }}>Placed on {dt(o.date)}</p>
      {o.status === "Cancelled"
        ? <p className="badge" style={{ marginBottom: 24, display: "inline-block" }}>Cancelled</p>
        : <div className="steps">{L.map((x, i) => <div key={x} className={i <= ix ? "d" : ""}>{x}</div>)}</div>}
      {o.status !== "Cancelled" && o.status !== "Delivered" && <p className="mute sm" style={{ marginBottom: 16 }}>Once your order is delivered we will invite you to review your watch. It is optional.</p>}
      <Panel style={{ marginBottom: 16 }}>
        {o.items.map((x) => {
          const w = products[x.id];
          return (
            <div className="line" key={x.id} style={{ gridTemplateColumns: "72px 1fr auto", padding: "12px 0" }}>
              <div className="t" style={{ width: 72, height: 72 }}><Img id={w.im[0]} w={200} /></div>
              <div><Link to={`/product/${w.id}`}>{w.n}</Link><div className="mute sm">Quantity {x.q}</div>
                {o.status === "Delivered" && (() => {
                  const key = `${o.id}:${w.id}`;
                  const rv = reviews.find((r) => r.key === key);
                  return rv
                    ? <div className="orev"><Stars n={rv.r} /><span className="mute sm">Your review{rv.status !== "published" ? ` (${rv.status === "pending" ? "waiting for approval" : "hidden"})` : ""}</span><button type="button" className="lnk" onClick={() => setDlg({ existing: rv })}>Edit</button></div>
                    : <Button variant="o" size="s" style={{ marginTop: 8 }} onClick={() => setDlg({ item: { key, pid: w.id, orderId: o.id } })}>Write a review</Button>;
                })()}
              </div>
              <div className="price" style={{ gridColumn: 3 }}>{fmt(x.p * x.q)}</div>
            </div>
          );
        })}
        <div className="sum">
          <div className="r"><span>Subtotal</span><span>{fmt(o.sub)}</span></div>
          {o.disc > 0 && <div className="r"><span>Discount {o.coupon}</span><span>−{fmt(o.disc)}</span></div>}
          <div className="r"><span>Delivery, {o.area}</span><span>{fmt(o.fee)}</span></div>
          <div className="r tot"><span>Total</span><span>{fmt(o.total)}</span></div>
        </div>
      </Panel>
      <Panel className="sm" style={{ marginBottom: 20 }}>
        <b style={{ fontWeight: 500 }}>Delivery to</b>
        <p className="mute">{o.name}, {o.phone}<br />{o.street}, {o.district}</p>
        <b style={{ fontWeight: 500, display: "block", marginTop: 12 }}>Payment</b>
        <p className="mute">{o.pay}, payment {(o.payStatus || "Pending").toLowerCase()}{o.payRef ? `, ref ${o.payRef}` : ""}</p>
      </Panel>
      <div className="row"><Button onClick={again}>Buy again</Button><Button to="/contact" variant="o">Need help?</Button></div>
      {dlg && <ReviewDialog {...dlg} onClose={() => setDlg(null)} />}
    </>
  );
}

export function Wishlist() {
  const { wish, products } = useStore();
  const pg = usePaged(wish, PAGE_SIZE.wishlist);
  return (
    <>
      <h1 className="h2" style={{ marginBottom: 24 }}>Wishlist</h1>
      {wish.length
        ? <div className="grid g3">{pg.items.map((i) => <ProductCard key={i} p={products[i]} />)}</div>
        : <Empty text="Tap the heart on any watch to save it here." />}
      <Pager {...pg} onPage={pg.setPage} noun="watches" />
    </>
  );
}

export function Addresses() {
  const { addrs, user, zones, saveAddr, deleteAddr } = useStore();
  const [ed, setEd] = useState(null); // null = closed, -1 = new, n = editing index
  const a = ed != null && ed >= 0 ? addrs[ed] : {};
  const submit = (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    saveAddr({ label: d.label, name: d.name, phone: d.phone, zone: +d.zone, district: d.district, street: d.street }, ed >= 0 ? ed : null);
    setEd(null);
  };
  return (
    <>
      <div className="head" style={{ marginBottom: 24, alignItems: "center" }}>
        <h1 className="h2">Addresses</h1>
        {ed == null && <Button size="s" onClick={() => setEd(-1)}>Add address</Button>}
      </div>
      {ed != null && (
        <form className="panel stack" style={{ marginBottom: 20 }} onSubmit={submit} key={ed}>
          <h2 className="h3">{ed >= 0 ? "Edit address" : "New address"}</h2>
          <div className="two">
            <Field label="Label"><Input name="label" required placeholder="Home" defaultValue={a.label} /></Field>
            <Field label="Full name"><Input name="name" required defaultValue={a.name || user.name} /></Field>
          </div>
          <div className="two">
            <Field label="Phone"><Input name="phone" type="tel" required defaultValue={a.phone || user.phone} /></Field>
            <Field label="Delivery area">
              <Select name="zone" defaultValue={a.zone || 0}>{zones.map((z, i) => <option key={i} value={i}>{z.name}</option>)}</Select>
            </Field>
          </div>
          <div className="two">
            <Field label="District"><Input name="district" required defaultValue={a.district} /></Field>
            <Field label="Street and landmark"><Input name="street" required defaultValue={a.street} /></Field>
          </div>
          <div className="row"><Button>Save address</Button><Button type="button" variant="o" onClick={() => setEd(null)}>Cancel</Button></div>
        </form>
      )}
      {addrs.map((x, i) => (
        <Panel className="row" style={{ justifyContent: "space-between", alignItems: "start", marginBottom: 12 }} key={i}>
          <div>
            <b style={{ fontWeight: 500 }}>{x.label}</b>
            <div className="mute sm">{x.name}, {x.phone}<br />{x.street}, {x.district}<br />{(zones[x.zone] || zones[0]).name}</div>
          </div>
          <div className="row"><Button variant="o" size="s" onClick={() => setEd(i)}>Edit</Button><Button variant="o" size="s" onClick={() => { if (window.confirm(`Delete the address "${x.label}"?`)) deleteAddr(i); }}>Delete</Button></div>
        </Panel>
      ))}
      {!addrs.length && ed == null && <Panel><p className="mute">Save an address to speed up checkout.</p></Panel>}
    </>
  );
}

export function Profile() {
  const { user, updateProfile } = useStore();
  return (
    <>
      <h1 className="h2" style={{ marginBottom: 24 }}>Profile</h1>
      <form className="panel stack" style={{ maxWidth: 480 }} onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); updateProfile(d.get("name"), d.get("phone")); }}>
        <Field label="Full name"><Input name="name" required defaultValue={user.name} /></Field>
        <Field label="Email"><Input value={user.email} disabled readOnly /></Field>
        <Field label="Phone"><Input name="phone" type="tel" defaultValue={user.phone} /></Field>
        <Button>Save changes</Button>
      </form>
    </>
  );
}
