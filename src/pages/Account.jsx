import { useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Chip, Empty, Field, Input, Pager, Panel, Select, ProductCard, Stars, usePaged } from "../ui";
import AccountShell from "../AccountShell";
import { PageHead } from "../AdminShell";
import ReviewDialog from "../ReviewDialog";
import { AuthBox } from "./Login";
import DateRange, { ymd } from "../DateRange";
import { fmt, dt } from "../lib";
import "../account-extras.css";

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

const ACTIVE = ["Placed", "Processing", "Dispatched"];

// One order in a list: the watch(es), the date, the status and the total.
const OrderRow = ({ o }) => {
  const { eligible, products } = useStore();
  const n = o.items.reduce((a, x) => a + x.q, 0);
  const todo = eligible.filter((e) => e.orderId === o.id).length; // delivered items still waiting for a review
  const ws = o.items.map((i) => products[i.id]).filter(Boolean);
  return (
    <Link className="panel orow" to={`/account/orders/${o.id}`}>
      <div className="orow-m">
        <div className="orow-th" aria-hidden="true">
          {ws[0] && <span><Img id={ws[0].im[0]} w={120} /></span>}
          {ws.length > 1 && <em>+{ws.length - 1}</em>}
        </div>
        <div className="orow-t">
          <b style={{ fontWeight: 500 }}>{o.id}</b>
          <div className="mute sm orow-n">{ws[0]?.n}{ws.length > 1 ? ` and ${ws.length - 1} more` : ""}</div>
          <div className="mute sm">{dt(o.date)}, {n} item{n > 1 ? "s" : ""}</div>
          {todo > 0 && <span className="rw-chip">Rate your {todo === 1 ? "watch" : `${todo} watches`}</span>}
        </div>
      </div>
      <StatusPill s={o.status} /><b>{fmt(o.total)}</b>
    </Link>
  );
};

// Delivery progress for an order that is on its way.
const STEPS = ["Placed", "Processing", "Dispatched", "Delivered"];
const Track = ({ o }) => {
  const ix = Math.max(1, STEPS.indexOf(o.status));
  return (
    <div className="ac-tk">
      <div className="ac-tk-h">
        <div><b style={{ fontWeight: 500 }}>{o.id}</b><span className="mute sm"> · {dt(o.date)} · {fmt(o.total)}</span></div>
        <Link className="lnk" to={`/account/orders/${o.id}`}>View details</Link>
      </div>
      <div className="steps" role="img" aria-label={`Order ${o.id}: ${o.status}`}>{STEPS.map((x, i) => <div key={x} className={i <= ix ? "d" : ""}>{x}</div>)}</div>
    </div>
  );
};

export function Overview() {
  const { user, orders, wish, eligible, products } = useStore();
  const live = orders.filter((o) => ACTIVE.includes(o.status));
  const spent = orders.filter((o) => o.status !== "Cancelled").reduce((a, o) => a + o.total, 0);
  const stats = [["Orders", orders.length, "orders"], ["In progress", live.length, "orders?f=active"], ["Total spent", fmt(spent), "orders", true], ["Wishlist", wish.length, "wishlist"]];
  return (
    <>
      <PageHead title={`Hi, ${user.name.split(" ")[0]}`} sub={`${user.email}. Here is a summary of your account.`} />
      <div className="stats s4">
        {stats.map(([l, n, to, money]) => <Link key={l} className="panel" to={`/account/${to}`}><div className={money ? "h2 ac-money" : "h2"}>{n}</div><div className="mute sm">{l}</div></Link>)}
      </div>
      {eligible.length > 0 && (
        <Panel className="rvcta">
          <div><b>{eligible.length === 1 ? `How do you like your ${products[eligible[0].pid].n}?` : `${eligible.length} delivered watches are waiting for your review`}</b>
            <p className="mute sm">A quick review helps other buyers. It is completely optional.</p></div>
          <Button size="s" to="/account/orders?f=review">Rate {eligible.length === 1 ? "it" : "them"}</Button>
        </Panel>
      )}
      {live.length > 0 && (
        <>
          <h2 className="h3">On its way</h2>
          <Panel className="ac-track">{live.slice(0, 3).map((o) => <Track key={o.id} o={o} />)}</Panel>
        </>
      )}
      <div className="head" style={{ margin: 0, alignItems: "baseline" }}>
        <h2 className="h3">Recent orders</h2>
        {orders.length > 3 && <Link className="lnk" to="/account/orders">View all {orders.length} orders</Link>}
      </div>
      {orders.length
        ? <div className="olist">{orders.slice(0, 3).map((o) => <OrderRow key={o.id} o={o} />)}</div>
        : <Panel className="ac-empty"><p className="mute">You have not placed an order yet. Your orders and their delivery progress will show here.</p><Button to="/shop" size="s">Browse watches</Button></Panel>}
    </>
  );
}

// Status filters for the orders list: [key, label, test]. "To review" needs the store, so it is added inside the page.
const ORDER_FILTERS = [
  ["all", "All", () => true],
  ["active", "In progress", (o) => ACTIVE.includes(o.status)],
  ["delivered", "Delivered", (o) => o.status === "Delivered"],
  ["cancelled", "Cancelled", (o) => o.status === "Cancelled"],
];
const rank = (o) => (ACTIVE.includes(o.status) ? 0 : 1);
const newest = (a, b) => new Date(b.date) - new Date(a.date);
const ORDER_SORTS = [
  ["new", "Newest first", newest],
  ["old", "Oldest first", (a, b) => newest(b, a)],
  ["high", "Highest total", (a, b) => b.total - a.total || newest(a, b)],
  ["active", "In progress first", (a, b) => rank(a) - rank(b) || newest(a, b)],
];

// The key starts the page fresh when it is opened from a link such as /account/orders?f=review.
export function Orders() {
  const { search } = useLocation();
  return <OrdersList key={search} />;
}

function OrdersList() {
  const { orders, eligible, products } = useStore();
  const [sp] = useSearchParams();
  const reviewIds = new Set(eligible.map((e) => e.orderId));
  const filters = [...ORDER_FILTERS, ["review", "To review", (o) => reviewIds.has(o.id)]];
  const [f, setF] = useState(filters.some(([k]) => k === sp.get("f")) ? sp.get("f") : "all");
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [sort, setSort] = useState("new");
  const lo = range.from, hi = range.to || range.from; // only a start day means that one day
  const needle = q.trim().toLowerCase();
  const days = {};
  orders.forEach((o) => { const d = ymd(new Date(o.date)); days[d] = (days[d] || 0) + 1; });

  // Everything except the status chip, so the numbers on the chips always match the search and the dates.
  const base = orders.filter((o) => {
    const d = ymd(new Date(o.date));
    return (!lo || (d >= lo && d <= hi)) && (!needle || `${o.id} ${o.items.map((i) => products[i.id]?.n || "").join(" ")}`.toLowerCase().includes(needle));
  });
  const test = filters.find((x) => x[0] === f)[2];
  const list = base.filter(test).sort(ORDER_SORTS.find(([k]) => k === sort)[2]);
  const pg = usePaged(list, PAGE_SIZE.orders, `${f}|${q}|${lo}|${hi}|${sort}`); // back to page 1 when anything changes
  const filtered = !!(f !== "all" || needle || lo);
  const clear = () => { setF("all"); setQ(""); setRange({ from: "", to: "" }); };
  const shown = !filtered ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}` : `${list.length} of ${orders.length} orders`;
  return (
    <>
      <PageHead title="Orders" sub={orders.length ? `${shown}. Open one to see its delivery progress.` : "Everything you order will be listed here."} />
      {orders.length > 0 && (
        <>
          <div className="ptool">
            <label className="psearch">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order number or watch" aria-label="Search your orders" />
            </label>
            <DateRange value={range} onChange={setRange} counts={days} />
            <Select className="pdate-sel" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort orders">
              {ORDER_SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            {filtered && <button type="button" className="lnk" onClick={clear}>Clear filters</button>}
          </div>
          <div className="row ofilters" role="group" aria-label="Filter orders by status">
            {filters.map(([k, label, t]) => {
              const n = base.filter(t).length;
              return (k === "all" || n > 0 || k === f) && (
                <Chip key={k} on={f === k} aria-pressed={f === k} onClick={() => setF(k)}>{label}<span className="ocnt">{n}</span></Chip>
              );
            })}
          </div>
        </>
      )}
      {orders.length === 0
        ? <Empty text="Your orders will appear here once you place one." to="/shop" label="Browse watches" />
        : list.length
          ? <div className="olist">{pg.items.map((o) => <OrderRow key={o.id} o={o} />)}</div>
          : <Panel><p className="mute" style={{ marginBottom: 16 }}>No orders match your filters.</p><Button variant="o" size="s" onClick={clear}>Clear filters</Button></Panel>}
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
