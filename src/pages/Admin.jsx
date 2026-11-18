import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Badge, Field, Input, Pager, Panel, Select, Chip, Stars, Table, Textarea, usePaged } from "../ui";
import { IM, PAY_STATUS, PERM, ST } from "../data";
import { ussd, waLink } from "../pay";
import { fmt, dt, tm, readImage, byNewest } from "../lib";
import ProductForm from "../ProductForm";
import DateRange, { ymd } from "../DateRange";
import AdminShell, { PageHead } from "../AdminShell";
import { MAX_VIDEO, deleteVideo, mmss, probeVideo, putVideo } from "../videoDb";

// How many rows each admin list shows per page.
const PAGE_SIZE = { orders: 8, products: 8, coupons: 8, team: 8, audit: 10, reviews: 8, messages: 8, subscribers: 10 };

const None = ({ text }) => <Panel><p className="mute">{text}</p></Panel>;
// Every admin page starts with the same header: a title, an optional line of help text and optional buttons.
const Title = ({ children, sub, actions }) => <PageHead title={children} sub={sub} actions={actions} />;
const PayPill = ({ s }) => <span className={`pill ${s === "Paid" ? "good" : s === "Failed" ? "bad" : "warn"}`}>{s}</span>;
const Chev = ({ up }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
);
const StatusSelect = ({ o }) => {
  const { setOrderStatus } = useStore();
  return (
    <Select style={{ height: 36, width: "auto" }} value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value)} aria-label="Order status">
      {ST.map((s) => <option key={s}>{s}</option>)}
    </Select>
  );
};

const PaySelect = ({ o }) => {
  const { setPayStatus } = useStore();
  return (
    <Select style={{ height: 36, width: "auto" }} value={o.payStatus || "Pending"} onChange={(e) => setPayStatus(o.id, e.target.value)} aria-label="Payment status">
      {PAY_STATUS.map((s) => <option key={s}>{s}</option>)}
    </Select>
  );
};

function AdminLogin() {
  const { adminSignIn } = useStore();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    await adminSignIn(d.get("email"), d.get("pw"));
    setBusy(false);
  };
  return (
    <div className="ax-login">
      <form className="ax-lc" onSubmit={submit}>
        <div className="ax-lh">
          <span className="ax-mark">D</span>
          <div><h1>Welcome back</h1><p>Sign in to the DUCHI admin area.</p></div>
        </div>
        <Field label="Email"><Input name="email" type="email" required autoComplete="username" placeholder="you@duchistore.rw" /></Field>
        <Field label="Password"><Input name="pw" type={show ? "text" : "password"} required autoComplete="current-password" /></Field>
        <label className="fchk"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /><span>Show password</span></label>
        <Button block disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
        <p className="mute sm ax-ld">Demo accounts: admin@duchistore.rw, manager@duchistore.rw or staff@duchistore.rw. Password: admin123 (change it in Settings after signing in).</p>
        <Link className="mute sm" to="/">Back to the store</Link>
      </form>
    </div>
  );
}

// The signed-in admin area: sidebar, top bar and the current page (see AdminShell.jsx).
export default function Admin() {
  const { adm } = useStore();
  return adm ? <AdminShell /> : <AdminLogin />;
}
export { default as Settings } from "../AdminSettings";

// Page-level permission check.
function Allow({ sec, children }) {
  const { adm } = useStore();
  return PERM[adm.role].includes(sec) ? children : <None text="Your role does not have access to this page." />;
}

function OrdersTable({ list }) {
  if (!list.length) return <None text="No orders yet." />;
  return (
    <Table head={["Order", "Customer", "Contact", "Date", "Total", "Payment", "Status"]}>
      {list.map((o) => (
        <tr key={o.id}>
          <td><Link to={`/admin/orders/${o.id}`}><b style={{ fontWeight: 500 }}>{o.id}</b></Link></td>
          <td>{o.name}</td>
          <td><div className="contact"><a href={`tel:${o.phone}`}>{o.phone}</a><a href={`mailto:${o.cEmail || o.email}`}>{o.cEmail || o.email}</a></div></td>
          <td className="nw">{dt(o.date)}</td><td className="nw">{fmt(o.total)}</td>
          <td><div><PayPill s={o.payStatus || "Pending"} /><div className="mute sm" style={{ marginTop: 4 }}>{o.pay}</div></div></td>
          <td><StatusSelect o={o} /></td>
        </tr>
      ))}
    </Table>
  );
}

const short = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1000 ? Math.round(v / 1000) + "k" : v ? String(v) : "");

export function Dashboard() {
  const { allOrders, products } = useStore();
  const ok = allOrders.filter((o) => o.status !== "Cancelled");
  const rev = ok.reduce((a, o) => a + o.total, 0);
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return { l: i === 6 ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" }), today: i === 6, v: ok.filter((o) => new Date(o.date).toDateString() === d.toDateString()).reduce((a, o) => a + o.total, 0) };
  });
  const mx = Math.max(1, ...days.map((x) => x.v));
  const week = days.reduce((a, x) => a + x.v, 0);
  const low = products.filter((p) => p.stock <= 5).sort((a, b) => a.stock - b.stock);
  const todo = allOrders.filter((o) => o.status === "Processing").length;
  const kpis = [
    ["Revenue", fmt(rev), "Without cancelled orders"],
    ["Orders", allOrders.length, `${ok.length} not cancelled`],
    ["To process", todo, todo ? "Waiting for you" : "All caught up"],
    ["Low stock", low.length, "5 or fewer left"],
  ];
  return (
    <>
      <Title sub="A quick look at sales, orders and stock.">Dashboard</Title>
      <div className="kpis">{kpis.map(([l, v, n]) => <Panel key={l} className="kpi"><div className="kl">{l}</div><div className="kv">{v}</div><div className="kn">{n}</div></Panel>)}</div>
      <div className="dgrid">
        <Panel>
          <div className="head" style={{ alignItems: "baseline" }}><b style={{ fontWeight: 500 }}>Revenue, last 7 days</b><span className="mute sm">{fmt(week)}</span></div>
          <div className="bars">{days.map((x) => (
            <div key={x.l} className={x.today ? "today" : ""}>
              <em>{short(x.v)}</em><i style={{ height: `calc((100% - 48px) * ${(x.v / mx).toFixed(3)})` }} title={fmt(x.v)} /><span>{x.l}</span>
            </div>
          ))}</div>
          {!allOrders.length && <p className="mute sm" style={{ marginTop: 12 }}>Revenue will show here once customers place orders.</p>}
        </Panel>
        <Panel className="lowst">
          <div className="head" style={{ alignItems: "baseline" }}><b style={{ fontWeight: 500 }}>Needs restocking</b><Link className="mute sm" to="/admin/products">Manage stock</Link></div>
          {low.length ? (
            <ul>{low.slice(0, 5).map((p) => (
              <li key={p.id}>
                <div className="lthumb"><Img id={p.im[0]} w={100} /></div>
                <div className="lname">{p.n}<span className="mute sm">{p.c}</span></div>
                <span className={`pill ${p.stock === 0 ? "bad" : "warn"}`}>{p.stock === 0 ? "Sold out" : `${p.stock} left`}</span>
              </li>
            ))}</ul>
          ) : <p className="mute sm" style={{ marginTop: 12 }}>Every product has more than 5 in stock.</p>}
        </Panel>
      </div>
      <div className="head" style={{ margin: "32px 0 12px", alignItems: "center" }}>
        <h2 className="h3">Recent orders</h2>
        {allOrders.length > 5 && <Link className="mute sm" to="/admin/orders">View all orders</Link>}
      </div>
      <OrdersTable list={allOrders.slice(0, 5)} />
    </>
  );
}

export function AdminOrders() {
  const { allOrders } = useStore();
  const [f, setF] = useState("All");
  const list = f === "All" ? allOrders : allOrders.filter((o) => o.status === f);
  const pg = usePaged(list, PAGE_SIZE.orders, f);
  return (
    <Allow sec="orders">
      <Title sub={`${allOrders.length} ${allOrders.length === 1 ? "order" : "orders"} in total. Change a status and the customer sees it straight away.`}>Orders</Title>
      <div className="row chips" style={{ marginBottom: 20 }}>
        {["All", ...ST].map((c) => <Chip key={c} on={c === f} onClick={() => setF(c)}>{c}</Chip>)}
      </div>
      <OrdersTable list={pg.items} />
      <Pager {...pg} onPage={pg.setPage} noun="orders" />
    </Allow>
  );
}

export function AdminOrderDetail() {
  const { id } = useParams();
  const { allOrders, products } = useStore();
  const o = allOrders.find((x) => x.id === id);
  if (!o) return <None text="Order not found." />;
  return (
    <>
      <Title sub={`Placed ${tm(o.date)} by ${o.name}`} actions={<><Button to="/admin/orders" variant="o" size="s">Back to orders</Button><StatusSelect o={o} /></>}>Order {o.id}</Title>
      <Panel style={{ marginBottom: 16 }}>
        {o.items.map((x) => <div className="r row" style={{ justifyContent: "space-between", padding: "8px 0" }} key={x.id}><span>{products[x.id].n} × {x.q}</span><span>{fmt(x.p * x.q)}</span></div>)}
        <div className="sum">
          <div className="r"><span>Subtotal</span><span>{fmt(o.sub)}</span></div>
          {o.disc > 0 && <div className="r"><span>Discount {o.coupon}</span><span>−{fmt(o.disc)}</span></div>}
          <div className="r"><span>Delivery, {o.area}</span><span>{fmt(o.fee)}</span></div>
          <div className="r tot"><span>Total</span><span>{fmt(o.total)}</span></div>
        </div>
      </Panel>
      <Panel className="sm" style={{ marginBottom: 16 }}>
        <b style={{ fontWeight: 500 }}>Contact the customer</b>
        <p className="mute" style={{ margin: "6px 0 12px" }}>{o.name}<br />{o.phone}<br />{o.cEmail || o.email}</p>
        <div className="row">
          <Button variant="o" size="s" href={`tel:${o.phone}`}>Call</Button>
          <Button variant="o" size="s" href={waLink(o.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</Button>
          <Button variant="o" size="s" href={`mailto:${o.cEmail || o.email}`}>Email</Button>
        </div>
        <b style={{ fontWeight: 500, display: "block", marginTop: 16 }}>Delivery address</b>
        <p className="mute">{o.street}, {o.district} ({o.area})</p>
      </Panel>
      <Panel className="sm">
        <div className="head" style={{ marginBottom: 8, alignItems: "center" }}>
          <b style={{ fontWeight: 500 }}>Payment</b>
          <PaySelect o={o} />
        </div>
        <p className="mute">{o.pay}{o.card ? `, card ending ${o.card.last4}` : ""}</p>
        {o.payRef && <p className="mute">Reference: {o.payRef}</p>}
        {o.payPhone && <p className="mute">Paid from: <a href={`tel:${o.payPhone}`}>{o.payPhone}</a></p>}
      </Panel>
    </>
  );
}

export function AdminProducts() {
  const { products, cats, adm, toggleProduct, setStock } = useStore();
  const [ed, setEd] = useState(null); // null closed, -1 new, n edit
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [show, setShow] = useState("All");
  const can = adm.role !== "Staff";
  const matches = products.filter((x) =>
    (cat === "All" || x.c === cat) && (x.n + " " + x.s).toLowerCase().includes(q.trim().toLowerCase())
    && (show === "All" || (show === "Visible" && x.active !== false) || (show === "Hidden" && x.active === false) || (show === "Low stock" && x.stock <= 5)))
    .sort(byNewest); // most recently added first
  const pg = usePaged(matches, PAGE_SIZE.products, `${q}|${cat}|${show}`);
  if (can && ed != null) {
    return <Allow sec="products"><ProductForm key={ed} p={ed >= 0 ? products[ed] : null} onDone={() => setEd(null)} /></Allow>;
  }
  const live = products.filter((x) => x.active !== false).length;
  const lowN = products.filter((x) => x.stock <= 5).length;
  const list = pg.items;
  return (
    <Allow sec="products">
      <Title sub={`${products.length} products, ${live} visible${lowN ? `, ${lowN} low on stock` : ""}. Newest first.`} actions={can && <Button size="s" onClick={() => setEd(-1)}>Add product</Button>}>Products and stock</Title>
      <div className="ptool">
        <label className="psearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" />
        </label>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="All">All categories</option>
          {cats.map((c) => <option key={c.name}>{c.name}</option>)}
        </Select>
        <div className="row chips">{["All", "Visible", "Hidden", "Low stock"].map((c) => <Chip key={c} on={c === show} onClick={() => setShow(c)}>{c}</Chip>)}</div>
      </div>
      {list.length ? (
        <Table head={["Product", "Category", "Price", "Stock", "Status", ...(can ? [""] : [])]}>
          {list.map((x) => (
            <tr key={x.id}>
              <td><div className="row" style={{ flexWrap: "nowrap" }}>
                <div className="pthumb"><Img id={x.im[0]} w={100} />{x.im.length > 1 && <span>{x.im.length}</span>}</div>
                <div>{x.n}<div className="mute sm">{x.s}</div></div>
              </div></td>
              <td>{x.c}</td><td className="nw">{fmt(x.p)}</td>
              <td><Input type="number" min="0" key={x.stock} defaultValue={x.stock} className={`stockin${x.stock === 0 ? " out" : x.stock <= 5 ? " low" : ""}`} style={{ width: 84, height: 36 }} aria-label={`Stock of ${x.n}`}
                onBlur={(e) => { if (+e.target.value !== x.stock) setStock(x.id, +e.target.value); }} /></td>
              <td><span className={`pill ${x.active === false ? "off" : "good"}`}>{x.active === false ? "Hidden" : "Visible"}</span></td>
              {can && <td><div className="row" style={{ flexWrap: "nowrap" }}>
                <Button variant="o" size="s" onClick={() => setEd(x.id)}>Edit</Button>
                <Button variant="o" size="s" onClick={() => toggleProduct(x.id)}>{x.active === false ? "Show" : "Hide"}</Button>
              </div></td>}
            </tr>
          ))}
        </Table>
      ) : <None text="No products match your search." />}
      <Pager {...pg} onPage={pg.setPage} noun="products" />
    </Allow>
  );
}

function CatName({ name, onSave }) {
  const [v, setV] = useState(name);
  useEffect(() => { setV(name); }, [name]);
  const commit = () => { const t = v.trim(); if (t && t !== name) { if (!onSave(t)) setV(name); } else setV(name); };
  return (
    <Input className="catname" value={v} maxLength={30} aria-label={`Name of category ${name}`}
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { setV(name); e.currentTarget.blur(); } }} />
  );
}

export function Categories() {
  const { cats, products, addCategory, renameCategory, deleteCategory, moveCategory, setCategoryImage, showToast } = useStore();
  const [name, setName] = useState("");
  const count = (c) => products.filter((p) => p.c === c.name).length;
  const cover = (c) => c.img || products.find((p) => p.c === c.name)?.im[0] || "";
  const submit = (e) => { e.preventDefault(); if (addCategory(name)) setName(""); };
  const pick = async (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Please choose an image file"); return; }
    try { setCategoryImage(i, await readImage(file, 900, 0.8)); } catch { showToast("Could not read that photo. Try a JPG or PNG."); }
  };
  return (
    <Allow sec="categories">
      <Title sub={`Categories sort your watches in the shop filters, the product form and the \"Shop by style\" tiles on the Home page. Rename one and its products follow automatically.`}>Categories</Title>
      <form className="panel catadd" onSubmit={submit}>
        <Field label="New category"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="e.g. Automatic" /></Field>
        <Button>Add category</Button>
      </form>
      {cats.length ? (
        <Table head={["Category", "Watches", "Order", ""]}>
          {cats.map((c, i) => {
            const n = count(c);
            return (
              <tr key={c.name}>
                <td><div className="row" style={{ flexWrap: "nowrap" }}>
                  <label className="catimg" title="Change the cover photo">
                    {cover(c) ? <Img id={cover(c)} w={140} /> : <b>+</b>}
                    <span>Change</span>
                    <input type="file" accept="image/*" aria-label={`Cover photo for ${c.name}`} onChange={(e) => pick(i, e)} />
                  </label>
                  <CatName name={c.name} onSave={(v) => renameCategory(i, v)} />
                </div></td>
                <td>{n} {n === 1 ? "watch" : "watches"}{n > 0 && <div className="mute sm">Cannot be deleted while it has watches</div>}</td>
                <td><div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                  <button type="button" className="ib arr" disabled={i === 0} onClick={() => moveCategory(i, -1)} aria-label={`Move ${c.name} up`}><Chev up /></button>
                  <button type="button" className="ib arr" disabled={i === cats.length - 1} onClick={() => moveCategory(i, 1)} aria-label={`Move ${c.name} down`}><Chev /></button>
                </div></td>
                <td><Button variant="o" size="s" disabled={n > 0} onClick={() => { if (window.confirm(`Delete the category "${c.name}"?`)) deleteCategory(i); }}>Delete</Button></td>
              </tr>
            );
          })}
        </Table>
      ) : <None text="No categories yet. Add your first one above." />}
    </Allow>
  );
}

export function Videos() {
  const { videos, saveVideos, showToast } = useStore();
  const [rows, setRows] = useState(() => Array.from({ length: 4 }, (_, i) => videos[i] || { title: "", src: "", poster: IM[i % IM.length] }));
  const [busy, setBusy] = useState({});
  const trash = useRef([]); // stored videos that were replaced or removed: deleted when you press Save
  const edit = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const mb = (n) => (n / 1048576).toFixed(n > 1048576 * 10 ? 0 : 1);

  const pick = async (i, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) { showToast("Please choose a video file (MP4 works best)"); return; }
    if (file.size > MAX_VIDEO) { showToast(`That video is ${mb(file.size)} MB. The limit is ${mb(MAX_VIDEO)} MB.`); return; }
    setBusy((b) => ({ ...b, [i]: true }));
    try {
      const meta = await probeVideo(file); // also proves this browser can play it
      const id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await putVideo(id, file);
      const old = rows[i].file?.id;
      if (old) trash.current.push(old);
      edit(i, { file: { id, name: file.name, size: file.size, poster: meta.poster, duration: meta.duration, w: meta.w, h: meta.h }, src: "" });
      showToast("Video ready. Press Save videos to show it on the home page.");
    } catch (err) {
      showToast(err?.code === "quota" ? "This browser has no space left for that video. Remove another video or use a smaller file."
        : "This browser could not read that video. Please upload an MP4 (H.264) or WebM file.");
    } finally { setBusy((b) => ({ ...b, [i]: false })); }
  };
  const remove = (i) => {
    if (rows[i].file?.id) trash.current.push(rows[i].file.id);
    edit(i, { file: null, src: "" });
    showToast(`Video ${i + 1} removed. Press Save videos to apply.`);
  };
  const submit = (e) => {
    e.preventDefault();
    saveVideos(rows.map((r) => ({ ...r, title: r.title.trim() || "Watch video", src: (r.src || "").trim() })));
    const keep = new Set(rows.map((r) => r.file?.id).filter(Boolean));
    trash.current.filter((id) => !keep.has(id)).forEach((id) => deleteVideo(id).catch(() => {}));
    trash.current = [];
  };
  return (
    <Allow sec="videos">
      <Title sub={`Four videos are shown in one row on the home page. Upload a video file from your phone or computer (MP4 works best, up to ${mb(MAX_VIDEO)} MB). The cover picture is taken from the video automatically. Empty slots show "Coming soon".`}>Showcase videos</Title>
      <form className="stack" onSubmit={submit}>
        {rows.map((r, i) => (
          <Panel key={i} className="stack">
            <div className="head" style={{ alignItems: "center" }}>
              <b style={{ fontWeight: 500 }}>Video {i + 1}</b>
              <span className={`pill ${r.file || r.src ? "good" : "off"}`}>{r.file || r.src ? "Ready" : "Empty"}</span>
            </div>
            <Field label="Title"><Input value={r.title} maxLength={40} onChange={(e) => edit(i, { title: e.target.value })} placeholder="e.g. On the wrist" /></Field>
            {r.file ? (
              <div className="vfile">
                <div className="vfile-th"><img src={r.file.poster} alt="" /><span>{mmss(r.file.duration || 0)}</span></div>
                <div className="vfile-info">
                  <b>{r.file.name}</b>
                  <span className="mute sm">{mb(r.file.size)} MB{r.file.w ? `, ${r.file.w} x ${r.file.h}` : ""}</span>
                  <div className="row" style={{ marginTop: 8 }}>
                    <label className={`btn btn-o btn-s upl${busy[i] ? " busy" : ""}`}>{busy[i] ? "Preparing..." : "Replace video"}
                      <input type="file" accept="video/*" disabled={busy[i]} aria-label={`Replace video ${i + 1}`} onChange={(e) => pick(i, e)} />
                    </label>
                    <Button type="button" variant="o" size="s" onClick={() => remove(i)}>Remove</Button>
                  </div>
                </div>
              </div>
            ) : (
              <label className={`vdrop${busy[i] ? " busy" : ""}`}>
                <input type="file" accept="video/*" disabled={busy[i]} aria-label={`Upload video ${i + 1}`} onChange={(e) => pick(i, e)} />
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                <b>{busy[i] ? "Preparing your video..." : <>Drop a video here or <u>browse</u></>}</b>
                <span className="mute sm">MP4 or WebM. Vertical videos look best.</span>
                {r.src && <span className="vold" onClick={(e) => e.preventDefault()}>Using the video link {r.src.slice(0, 40)}{r.src.length > 40 ? "..." : ""} <button type="button" onClick={() => edit(i, { src: "" })}>Remove link</button></span>}
              </label>
            )}
          </Panel>
        ))}
        <div><Button>Save videos</Button></div>
      </form>
    </Allow>
  );
}

export function ReviewsAdmin() {
  const { reviews, products, setReviewStatus, replyReview, deleteReview } = useStore();
  const [f, setF] = useState("All");
  const [q, setQ] = useState("");
  const [rep, setRep] = useState(null); // the review being answered
  const [text, setText] = useState("");
  const pending = reviews.filter((r) => r.status === "pending").length;
  const avg = reviews.length ? (reviews.reduce((a, r) => a + r.r, 0) / reviews.length).toFixed(1) : "0.0";
  const match = reviews.filter((r) =>
    (f === "All" || (f === "Published" && r.status === "published") || (f === "Pending" && r.status === "pending") || (f === "Hidden" && r.status === "hidden") || (f === "Low ratings" && r.r <= 2))
    && `${r.t} ${r.n} ${products[r.pid]?.n || ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const pg = usePaged(match, PAGE_SIZE.reviews, `${f}|${q}`);
  const status = { published: ["good", "Published"], pending: ["warn", "Pending"], hidden: ["off", "Hidden"] };
  return (
    <Allow sec="reviews">
      <Title sub={`${reviews.length} reviews, ${avg} stars on average.${pending ? ` ${pending} waiting for your approval.` : " Only customers who received a watch can review it."}`}>Reviews</Title>
      <div className="ptool">
        <label className="psearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviews" aria-label="Search reviews" />
        </label>
        <div className="row chips">{["All", "Published", ...(pending ? ["Pending"] : []), "Hidden", "Low ratings"].map((c) => <Chip key={c} on={c === f} onClick={() => setF(c)}>{c}</Chip>)}</div>
      </div>
      {pg.items.length ? (
        <Table head={["Review", "Product", "Rating", "Status", ""]}>
          {pg.items.map((r) => (
            <tr key={r.id}>
              <td><div className="rva">
                <div className="rva-h"><b>{r.n}</b>{r.verified && <span className="rw-vb">Verified buyer</span>}{r.sample && <span className="pill off">Sample</span>}<span className="mute sm">{dt(r.date)}</span></div>
                <p>{r.t}</p>
                {r.img && <div className="rva-img"><Img id={r.img} alt={`Photo from ${r.n}`} w={240} /></div>}
                {r.reply && rep !== r.id && <div className="rrep"><b>Your reply</b><p>{r.reply}</p></div>}
                {rep === r.id && (
                  <div className="rva-rep">
                    <Textarea rows={3} maxLength={400} value={text} onChange={(e) => setText(e.target.value)} placeholder="Thank the customer or answer a question. Everyone can read this." aria-label="Your reply" />
                    <div className="row">
                      <Button type="button" size="s" onClick={() => { replyReview(r.id, text); setRep(null); }}>Save reply</Button>
                      <Button type="button" variant="o" size="s" onClick={() => setRep(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div></td>
              <td><Link to={`/product/${r.pid}`}>{products[r.pid]?.n}</Link></td>
              <td><Stars n={r.r} /></td>
              <td><span className={`pill ${status[r.status][0]}`}>{status[r.status][1]}</span></td>
              <td><div className="row" style={{ flexWrap: "nowrap" }}>
                <Button variant="o" size="s" onClick={() => setReviewStatus(r.id, r.status === "published" ? "hidden" : "published")}>{r.status === "published" ? "Hide" : "Publish"}</Button>
                <Button variant="o" size="s" onClick={() => { setRep(r.id); setText(r.reply || ""); }}>{r.reply ? "Edit reply" : "Reply"}</Button>
                <Button variant="o" size="s" onClick={() => { if (window.confirm("Delete this review for good?")) deleteReview(r.id); }}>Delete</Button>
              </div></td>
            </tr>
          ))}
        </Table>
      ) : <None text={reviews.length ? "No reviews match your search." : "Customer reviews will be listed here."} />}
      <Pager {...pg} onPage={pg.setPage} noun="reviews" />
    </Allow>
  );
}

export function Messages() {
  const { messages, setMessageRead, deleteMessage } = useStore();
  const [f, setF] = useState("All");
  const [q, setQ] = useState("");
  const unread = messages.filter((m) => !m.read).length;
  const match = messages.filter((m) =>
    (f === "All" || (f === "Unread" && !m.read) || (f === "Read" && m.read))
    && `${m.name} ${m.email} ${m.phone} ${m.text}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // newest first
  const pg = usePaged(match, PAGE_SIZE.messages, `${f}|${q}`);
  return (
    <Allow sec="messages">
      <Title sub={`${messages.length} ${messages.length === 1 ? "message" : "messages"} from the Contact page${unread ? `, ${unread} not read yet` : ""}. Newest first.`}>Messages</Title>
      <div className="ptool">
        <label className="psearch">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" aria-label="Search messages" />
        </label>
        <div className="row chips">{["All", "Unread", "Read"].map((c) => <Chip key={c} on={c === f} onClick={() => setF(c)}>{c}</Chip>)}</div>
      </div>
      {pg.items.length ? (
        <Table head={["Message", "Contact", "Received", "Status", ""]}>
          {pg.items.map((m) => (
            <tr key={m.id}>
              <td><div className="rva">
                <div className="rva-h"><b>{m.name}</b></div>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text}</p>
              </div></td>
              <td><div className="contact">
                <a href={`mailto:${m.email}`}>{m.email}</a>
                {m.phone && <a href={`tel:${m.phone}`}>{m.phone}</a>}
                {m.phone && <a href={waLink(m.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
              </div></td>
              <td className="nw">{tm(m.date)}</td>
              <td><span className={`pill ${m.read ? "off" : "warn"}`}>{m.read ? "Read" : "New"}</span></td>
              <td><div className="row" style={{ flexWrap: "nowrap" }}>
                <Button variant="o" size="s" href={`mailto:${m.email}?subject=${encodeURIComponent("Your message to DUCHI")}`} onClick={() => { if (!m.read) setMessageRead(m.id, true, true); }}>Reply</Button>
                <Button variant="o" size="s" onClick={() => setMessageRead(m.id, !m.read)}>{m.read ? "Mark unread" : "Mark read"}</Button>
                <Button variant="o" size="s" onClick={() => { if (window.confirm(`Delete the message from ${m.name}?`)) deleteMessage(m.id); }}>Delete</Button>
              </div></td>
            </tr>
          ))}
        </Table>
      ) : <None text={messages.length ? "No messages match your search." : "Messages sent from the Contact page will be listed here."} />}
      <Pager {...pg} onPage={pg.setPage} noun="messages" />
    </Allow>
  );
}

// A spreadsheet can run text that starts with = + - or @ as a formula, so those cells get a leading apostrophe.
const csvCell = (v) => { const t = String(v); return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replace(/"/g, '""')}"`; };

export function Subscribers() {
  const { subscribers, removeSubscriber, showToast } = useStore();
  const [q, setQ] = useState("");
  // Newest first. Sign-ups from before dates were recorded have no date and keep the order they were saved in.
  const all = subscribers.map((s, i) => ({ ...s, i })).sort((a, b) => (new Date(b.date || 0) - new Date(a.date || 0)) || b.i - a.i);
  const match = all.filter((s) => s.email.toLowerCase().includes(q.trim().toLowerCase()));
  const pg = usePaged(match, PAGE_SIZE.subscribers, q);
  const copy = async () => {
    try { await navigator.clipboard.writeText(all.map((s) => s.email).join(", ")); showToast(`${all.length} email addresses copied`); }
    catch { showToast("Copy is not available on this device"); }
  };
  const download = () => {
    const rows = all.map((s) => `${csvCell(s.email)},${csvCell(s.date ? new Date(s.date).toISOString() : "")}`);
    const url = URL.createObjectURL(new Blob(["\ufeffEmail,Signed up\r\n" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `duchi-email-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Allow sec="subscribers">
      <Title sub={`${all.length} ${all.length === 1 ? "person has" : "people have"} joined to hear about new arrivals. Newest first.`}
        actions={all.length > 0 && <><Button variant="o" size="s" onClick={copy}>Copy emails</Button><Button size="s" onClick={download}>Download CSV</Button></>}>Email list</Title>
      {all.length > 0 && (
        <div className="ptool">
          <label className="psearch">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emails" aria-label="Search emails" />
          </label>
        </div>
      )}
      {pg.items.length ? (
        <Table head={["Email", "Signed up", ""]}>
          {pg.items.map((s) => (
            <tr key={s.email}>
              <td><a href={`mailto:${s.email}`}>{s.email}</a></td>
              <td className="nw">{s.date ? dt(s.date) : <span className="mute">Date not recorded</span>}</td>
              <td><Button variant="o" size="s" onClick={() => { if (window.confirm(`Remove ${s.email} from the email list?`)) removeSubscriber(s.email); }}>Remove</Button></td>
            </tr>
          ))}
        </Table>
      ) : <None text={all.length ? "No emails match your search." : "People who join from the \"Stay Ahead of Time\" form on the Home page will be listed here."} />}
      <Pager {...pg} onPage={pg.setPage} noun="emails" />
      <Panel className="sm" style={{ marginTop: 20 }}>
        <b style={{ fontWeight: 500 }}>Using this list</b>
        <p className="mute">Download the CSV to import it into your mailing service, or copy the addresses to paste into an email. When you remove someone, they can sign up again from the Home page.</p>
      </Panel>
    </Allow>
  );
}

export function Coupons() {
  const { coupons, addCoupon, toggleCoupon } = useStore();
  const pg = usePaged(coupons, PAGE_SIZE.coupons);
  const submit = (e) => {
    e.preventDefault();
    const form = e.currentTarget, d = Object.fromEntries(new FormData(form));
    if (addCoupon({ code: d.code.trim().toUpperCase(), type: d.type, val: +d.val, active: true })) form.reset();
  };
  return (
    <Allow sec="coupons">
      <Title sub="Discount codes customers can enter at checkout.">Coupons</Title>
      <form className="panel row" style={{ marginBottom: 20, alignItems: "end" }} onSubmit={submit}>
        <Field label="Code"><Input name="code" required style={{ textTransform: "uppercase" }} /></Field>
        <Field label="Type"><Select name="type"><option value="pct">Percent off</option><option value="fix">Fixed RWF off</option></Select></Field>
        <Field label="Value"><Input name="val" type="number" min="1" required /></Field>
        <Button>Create coupon</Button>
      </form>
      {coupons.length ? (
        <Table head={["Code", "Discount", "Status", ""]}>
          {pg.items.map((c) => { const i = coupons.indexOf(c); return (
            <tr key={c.code}>
              <td><b style={{ fontWeight: 500 }}>{c.code}</b></td>
              <td>{c.type === "pct" ? c.val + "%" : fmt(c.val)}</td>
              <td><Badge soft>{c.active ? "Active" : "Off"}</Badge></td>
              <td><Button variant="o" size="s" onClick={() => toggleCoupon(i)}>{c.active ? "Turn off" : "Turn on"}</Button></td>
            </tr>
          ); })}
        </Table>
      ) : <None text="No coupons yet." />}
      <Pager {...pg} onPage={pg.setPage} noun="coupons" />
    </Allow>
  );
}

export function Shipping() {
  const { zones, saveZones } = useStore();
  const [rows, setRows] = useState(zones);
  const edit = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <Allow sec="shipping">
      <Title sub="One flat fee per order. Changes show on the store straight away.">Shipping zones</Title>
      <form className="panel stack" style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); saveZones(rows.map((r) => ({ name: r.name, fee: +r.fee || 0 }))); }}>
        {rows.map((z, i) => (
          <div className="two" key={i}>
            <Field label="Zone name"><Input required value={z.name} onChange={(e) => edit(i, "name", e.target.value)} /></Field>
            <Field label="Fee (RWF)"><Input type="number" min="0" required value={z.fee} onChange={(e) => edit(i, "fee", e.target.value)} /></Field>
          </div>
        ))}
        <div className="row">
          <Button>Save shipping</Button>
          <Button type="button" variant="o" onClick={() => setRows([...rows, { name: "New zone", fee: 0 }])}>Add zone</Button>
        </div>
      </form>
    </Allow>
  );
}

export function Team() {
  const { staff, addStaff, setRole, toggleStaff } = useStore();
  const pg = usePaged(staff, PAGE_SIZE.team);
  const submit = (e) => {
    e.preventDefault();
    const form = e.currentTarget, d = Object.fromEntries(new FormData(form));
    if (addStaff({ name: d.name, email: d.email.toLowerCase(), role: d.role, active: true })) form.reset();
  };
  return (
    <Allow sec="team">
      <Title sub="Who can sign in to this admin area and what they can open.">Team and roles</Title>
      <form className="panel row" style={{ marginBottom: 20, alignItems: "end" }} onSubmit={submit}>
        <Field label="Name"><Input name="name" required /></Field>
        <Field label="Email"><Input name="email" type="email" required /></Field>
        <Field label="Role"><Select name="role"><option>Staff</option><option>Manager</option><option>Admin</option></Select></Field>
        <Button>Add member</Button>
      </form>
      <Table head={["Name", "Email", "Role", "Status", ""]}>
        {pg.items.map((m) => { const i = staff.indexOf(m); return (
          <tr key={m.email}>
            <td>{m.name}</td><td>{m.email}</td>
            <td><Select style={{ height: 36, width: "auto" }} value={m.role} onChange={(e) => setRole(i, e.target.value)}><option>Admin</option><option>Manager</option><option>Staff</option></Select></td>
            <td><Badge soft>{m.active ? "Active" : "Off"}</Badge></td>
            <td><Button variant="o" size="s" onClick={() => toggleStaff(i)}>{m.active ? "Turn off" : "Turn on"}</Button></td>
          </tr>
        ); })}
      </Table>
      <Pager {...pg} onPage={pg.setPage} noun="team members" />
      <Panel className="sm" style={{ marginTop: 20 }}>
        <b style={{ fontWeight: 500 }}>What each role can do</b>
        <p className="mute">Admin: everything, including team and roles. Manager: orders, products, messages, the email list, coupons, shipping and the audit log. Staff: view orders, update order status and stock.</p>
      </Panel>
    </Allow>
  );
}

export function Audit() {
  const { audit } = useStore();
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ from: "", to: "" }); // one picker: a start day and an optional end day
  const needle = q.trim().toLowerCase();
  const lo = range.from, hi = range.to || range.from; // only a start day means that one day
  // How many actions happened on each day: the calendar puts a green dot on days that have any.
  const counts = {};
  audit.forEach((x) => { const d = ymd(new Date(x.t)); counts[d] = (counts[d] || 0) + 1; });
  // The search looks at who, what, and the date and time exactly as shown in the table (for example "18 Nov" or "14:30").
  const match = audit.filter((x) => {
    const d = ymd(new Date(x.t));
    return (!lo || (d >= lo && d <= hi)) && (!needle || `${x.w} ${x.m} ${tm(x.t)} ${dt(x.t)}`.toLowerCase().includes(needle));
  });
  const pg = usePaged(match, PAGE_SIZE.audit, `${q}|${lo}|${hi}`);
  const filtered = !!(needle || lo);
  return (
    <Allow sec="audit">
      <Title sub="A record of what was done in the admin area, newest first.">Audit log</Title>
      {audit.length > 0 && (
        <div className="ptool">
          <label className="psearch">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person, action or time" aria-label="Search the audit log" />
          </label>
          <DateRange value={range} onChange={setRange} counts={counts} />
          {filtered && <button type="button" className="lnk" onClick={() => { setQ(""); setRange({ from: "", to: "" }); }}>Clear filters</button>}
        </div>
      )}
      {pg.items.length ? (
        <Table head={["When", "Who", "Action"]}>
          {pg.items.map((x, i) => <tr key={x.t + i}><td>{tm(x.t)}</td><td>{x.w}</td><td>{x.m}</td></tr>)}
        </Table>
      ) : <None text={audit.length ? "No entries match your filters." : "Actions taken in the admin area will be listed here."} />}
      <Pager {...pg} onPage={pg.setPage} noun="entries" />
    </Allow>
  );
}

export function Payments() {
  const { payCfg, savePayCfg } = useStore();
  const [c, setC] = useState(payCfg);
  const set = (net, k, v) => setC({ ...c, [net]: { ...c[net], [k]: v } });
  const stripeOn = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return (
    <Allow sec="payments">
      <Title sub="Customers see these codes at checkout. The dial button opens their phone with the code filled in.">Payments</Title>
      <form className="stack" style={{ maxWidth: 620 }} onSubmit={(e) => { e.preventDefault(); savePayCfg(c); }}>
        {[["mtn", "MTN Mobile Money"], ["airtel", "Airtel Money"]].map(([net, label]) => (
          <Panel className="stack" key={net}>
            <h2 className="h3">{label}</h2>
            <Field label="Merchant code"><Input required value={c[net].code} onChange={(e) => set(net, "code", e.target.value)} /></Field>
            <Field label="USSD to dial (use {code} and {amount})"><Input required value={c[net].tpl} onChange={(e) => set(net, "tpl", e.target.value)} /></Field>
            <p className="sm mute">Customers will dial: <b className="ussd">{ussd(c[net].tpl, c[net].code, 10000)}</b> (example for RWF 10,000). Confirm the exact code with {net === "mtn" ? "MTN" : "Airtel"} before going live.</p>
          </Panel>
        ))}
        <Button>Save payment settings</Button>
      </form>
      <Panel className="sm" style={{ marginTop: 20, maxWidth: 620 }}>
        <b style={{ fontWeight: 500 }}>Card payments (Stripe)</b>
        <p className="mute">{stripeOn ? "A Stripe publishable key is set. Customers see the real Stripe card field." : "No Stripe key is set yet, so checkout shows a preview card form. Add VITE_STRIPE_PUBLISHABLE_KEY to a .env file and restart to use the real Stripe field."}</p>
      </Panel>
    </Allow>
  );
}
