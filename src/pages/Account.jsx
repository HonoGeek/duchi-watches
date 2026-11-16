import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Chip, Empty, Field, Input, Pager, Panel, Select, ProductCard, Stars, usePaged } from "../ui";
import AccountShell from "../AccountShell";
import { PageHead } from "../AdminShell";
import ReviewDialog from "../ReviewDialog";
import { AuthBox } from "./Login";
import { fmt, dt } from "../lib";

// Rows per page in the customer area.
const PAGE_SIZE = { orders: 6, wishlist: 6 };

// Signed out: a sign-in page inside the shop layout. Signed in: the dashboard (see AccountShell.jsx).
export default function Account() {
  const { user } = useStore();
  if (!user) {
    return (
      <section style={{ paddingTop: 56 }}><div className="wrap" style={{ maxWidth: 440 }}>
        <h1 className="h2" style={{ marginBottom: 24 }}>Welcome to DUCHI</h1>
        <AuthBox />
      </div></section>
    );
  }
  return <AccountShell />;
}

// Order status as a small colored pill (colors live in home-refine.css, keyed by data-s).
const StatusPill = ({ s }) => <span className="badge spill" data-s={s}>{s}</span>;

const OrderRow = ({ o }) => {
  const { eligible } = useStore();
  const n = o.items.reduce((a, x) => a + x.q, 0);
  const todo = eligible.filter((e) => e.orderId === o.id).length; // delivered items still waiting for a review
  return (
    <Link className="panel orow" to={`/account/orders/${o.id}`}>
      <div><b style={{ fontWeight: 500 }}>{o.id}</b><div className="mute sm">{dt(o.date)}, {n} item{n > 1 ? "s" : ""}</div>
        {todo > 0 && <span className="rw-chip">Rate your {todo === 1 ? "watch" : `${todo} watches`}</span>}</div>
      <StatusPill s={o.status} /><b>{fmt(o.total)}</b>
    </Link>
  );
};

export function Overview() {
  const { user, orders, wish, addrs, eligible, products } = useStore();
  const stats = [["Orders", orders.length, "orders"], ["Wishlist", wish.length, "wishlist"], ["Saved addresses", addrs.length, "addresses"]];
  return (
    <>
      <PageHead title={`Hi, ${user.name.split(" ")[0]}`} sub={`${user.email}. Here is a summary of your account.`} />
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
      <h2 className="h3">Latest order</h2>
      {orders[0] ? <OrderRow o={orders[0]} /> : <Empty text="You have not placed an order yet." />}
    </>
  );
}

// Status filters for the orders list: [key, label, test]
const ORDER_FILTERS = [
  ["all", "All", () => true],
  ["active", "In progress", (o) => ["Placed", "Processing", "Dispatched"].includes(o.status)],
  ["delivered", "Delivered", (o) => o.status === "Delivered"],
  ["cancelled", "Cancelled", (o) => o.status === "Cancelled"],
];

export function Orders() {
  const { orders } = useStore();
  const [f, setF] = useState("all");
  const test = ORDER_FILTERS.find((x) => x[0] === f)[2];
  const list = orders.filter(test);
  const pg = usePaged(list, PAGE_SIZE.orders, f); // back to page 1 when the filter changes
  const shown = f === "all" ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}` : `${list.length} of ${orders.length} orders`;
  return (
    <>
      <PageHead title="Orders" sub={orders.length ? `${shown}. Open one to see its delivery progress.` : "Everything you order will be listed here."} />
      {orders.length > 0 && (
        <div className="row ofilters" role="group" aria-label="Filter orders by status">
          {ORDER_FILTERS.map(([k, label, t]) => {
            const n = orders.filter(t).length;
            return (k === "all" || n > 0 || k === f) && (
              <Chip key={k} on={f === k} aria-pressed={f === k} onClick={() => setF(k)}>{label}<span className="ocnt">{n}</span></Chip>
            );
          })}
        </div>
      )}
      {orders.length === 0
        ? <Empty text="Your orders will appear here once you place one." />
        : list.length
          ? <div className="olist">{pg.items.map((o) => <OrderRow key={o.id} o={o} />)}</div>
          : <Panel><p className="mute" style={{ marginBottom: 16 }}>No orders with this status.</p><Button variant="o" size="s" onClick={() => setF("all")}>Show all orders</Button></Panel>}
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
      <PageHead title={`Order ${o.id}`} sub={`Placed on ${dt(o.date)}`} actions={<Button to="/account/orders" variant="o" size="s">Back to orders</Button>} />
      {o.status === "Cancelled"
        ? <p style={{ marginBottom: 24 }}><StatusPill s="Cancelled" /></p>
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
      <PageHead title="Wishlist" sub={wish.length ? `${wish.length} saved ${wish.length === 1 ? "watch" : "watches"}.` : "Watches you save with the heart will be kept here."} />
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
      <PageHead title="Addresses" sub="Saved places we can deliver to. Pick one at checkout to save time." actions={ed == null && <Button size="s" onClick={() => setEd(-1)}>Add address</Button>} />
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
      <PageHead title="Profile" sub="The details we use for your orders and deliveries." />
      <form className="panel stack" style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); const d = new FormData(e.currentTarget); updateProfile(d.get("name"), d.get("phone")); }}>
        <Field label="Full name"><Input name="name" required defaultValue={user.name} /></Field>
        <Field label="Email"><Input value={user.email} disabled readOnly /></Field>
        <Field label="Phone"><Input name="phone" type="tel" defaultValue={user.phone} /></Field>
        <Button>Save changes</Button>
      </form>
    </>
  );
}
