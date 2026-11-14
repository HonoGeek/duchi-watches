import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ls, sv, hashPw, newSalt } from "./lib";
import { SEED_REVIEWS, REVIEWS_NEED_APPROVAL, SEED_PRODUCTS, SEED_CATS, SEED_ZONES, SEED_COUPONS, SEED_STAFF, SEED_PAYCFG, SEED_VIDEOS, DEMO_ADMIN_PASSWORD } from "./data";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

// useState that also saves to localStorage. Swap this for API calls later.
function usePersist(key, init) {
  const [v, setV] = useState(() => ls(key, typeof init === "function" ? init() : init));
  useEffect(() => { sv(key, v); }, [key, v]);
  return [v, setV];
}

export function StoreProvider({ children }) {
  const [products, setProducts] = usePersist("duchi-products", SEED_PRODUCTS);
  const [cats, setCats] = usePersist("duchi-cats", SEED_CATS);
  const [reviews, setReviews] = usePersist("duchi-reviews", SEED_REVIEWS);
  const [skipRev, setSkipRev] = usePersist("duchi-review-skip", []); // "Don't ask again" choices
  const [cart, setCart] = usePersist("duchi-cart", []);
  const [wish, setWish] = usePersist("duchi-wish", []);
  const [user, setUser] = usePersist("duchi-user", null);
  const [users, setUsers] = usePersist("duchi-users", {});
  const [allOrders, setAllOrders] = usePersist("duchi-all", []);
  const [addrMap, setAddrMap] = usePersist("duchi-addrs", {});
  const [zones, setZones] = usePersist("duchi-zones", SEED_ZONES);
  const [coupons, setCoupons] = usePersist("duchi-coupons", SEED_COUPONS);
  const [staff, setStaff] = usePersist("duchi-staff", SEED_STAFF);
  const [payCfg, setPayCfg] = usePersist("duchi-paycfg", SEED_PAYCFG);
  const [videos, setVideos] = usePersist("duchi-videos", SEED_VIDEOS);
  const [adm, setAdm] = usePersist("duchi-adm", null);
  const [axCol, setAxCol] = usePersist("duchi-ax-col", false); // admin sidebar collapsed?
  const [audit, setAudit] = usePersist("duchi-audit", []);
  const [theme, setTheme] = usePersist("duchi-theme", () =>
    window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const [toast, setToast] = useState(null);
  const timer = useRef();

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // showToast(message, { to, label } adds a link button; { action, label } adds a button that runs a function (e.g. Undo).
  // The icon is a tick for good news and an alert for problems; pass { type: "ok" | "err" } to force one.
  const showToast = (msg, opts = {}) => {
    const type = opts.type || (/\b(not|cannot|could not|couldn't|incorrect|only|no more|already|sold out|invalid|full|failed|please|move this)\b/i.test(msg) ? "err" : "ok");
    setToast({ msg, type, id: Date.now(), ...opts });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), opts.action ? 7000 : 4000);
  };
  const hideToast = () => { clearTimeout(timer.current); setToast(null); };
  // Uploaded photos are kept in the browser for now: warn when the browser says it is full.
  useEffect(() => {
    let last = 0;
    const on = () => {
      if (Date.now() - last < 4000) return;
      last = Date.now();
      showToast("Browser storage is full, so the last change was not saved. Remove some photos or use image links.");
    };
    window.addEventListener("duchi-storage-full", on);
    return () => window.removeEventListener("duchi-storage-full", on);
  }, []);
  const log = (m, who) =>
    setAudit((a) => [{ t: new Date().toISOString(), w: who || adm?.email || "system", m }, ...a].slice(0, 200));

  // ----- cart
  const subtotal = useMemo(() => cart.reduce((a, x) => a + products[x.id].p * x.q, 0), [cart, products]);
  const cartCount = cart.reduce((a, x) => a + x.q, 0);
  // Adds to the cart and shows a toast that names the product and how many were added.
  // Pass { silent: true } when the caller shows its own summary toast (e.g. "Buy again").
  const addToCart = (id, q = 1, { silent = false } = {}) => {
    const p = products[id];
    const have = cart.find((c) => c.id === id)?.q || 0;
    if (p.stock < have + q) {
      const left = Math.max(0, p.stock - have);
      showToast(p.stock <= 0 ? `${p.n} is sold out` : left > 0 ? `Only ${left} more of ${p.n} available` : `You already have all ${p.stock} ${p.n} in your cart`);
      return false;
    }
    if (!silent) showToast(`${q} × ${p.n} added to cart${have ? ` (${have + q} in cart)` : ""}`, { to: "/cart", label: "View cart" });
    setCart((c) => (have ? c.map((x) => (x.id === id ? { ...x, q: x.q + q } : x)) : [...c, { id, q }]));
    return true;
  };
  const changeQty = (id, d) => {
    const x = cart.find((c) => c.id === id);
    if (!x) return;
    if (d > 0 && x.q + d > products[id].stock) { showToast(`Only ${products[id].stock} × ${products[id].n} in stock`); return; }
    setCart((c) => c.map((y) => (y.id === id ? { ...y, q: Math.max(1, y.q + d) } : y)));
  };
  const removeFromCart = (id) => {
    const x = cart.find((c) => c.id === id);
    setCart((c) => c.filter((y) => y.id !== id));
    if (x) showToast(`${products[id].n} removed from your cart`, {
      label: "Undo", action: () => { setCart((c) => (c.some((y) => y.id === id) ? c : [...c, x])); showToast(`${products[id].n} is back in your cart`); },
    });
  };

  // ----- customer account
  const signIn = ({ email, name, phone, register }) => {
    const em = email.toLowerCase();
    const u = (!register && users[em]) || { name: name || em.split("@")[0], email: em, phone: phone || "" };
    setUsers((m) => ({ ...m, [em]: u }));
    setUser(u);
    showToast(`Welcome${register ? "" : " back"}, ${u.name.split(" ")[0]}`);
  };
  const signOut = () => { setUser(null); showToast("You have signed out"); };
  const updateProfile = (name, phone) => {
    const u = { ...user, name, phone };
    setUser(u);
    setUsers((m) => ({ ...m, [u.email]: u }));
    showToast("Profile saved");
  };
  const toggleWish = (id) => {
    const on = wish.includes(id);
    setWish((w) => (on ? w.filter((x) => x !== id) : [...w, id]));
    showToast(on ? `${products[id].n} removed from your wishlist` : `${products[id].n} saved to your wishlist`);
  };
  const orders = useMemo(() => (user ? allOrders.filter((o) => o.email === user.email) : []), [allOrders, user]);
  const addrs = user ? addrMap[user.email] || [] : [];
  const saveAddr = (a, index) => {
    const list = [...addrs];
    index != null ? (list[index] = a) : list.push(a);
    setAddrMap((m) => ({ ...m, [user.email]: list }));
    showToast("Address saved");
  };
  const deleteAddr = (i) => { setAddrMap((m) => ({ ...m, [user.email]: addrs.filter((_, k) => k !== i) })); showToast("Address deleted"); };

  // ----- reviews
  const published = useMemo(() => reviews.filter((r) => r.status === "published"), [reviews]);
  const reviewStats = useMemo(() => {
    const m = {};
    published.forEach((r) => { if (!m[r.pid]) m[r.pid] = { sum: 0, count: 0 }; m[r.pid].sum += r.r; m[r.pid].count++; });
    Object.values(m).forEach((s) => { s.avg = s.sum / s.count; });
    return m;
  }, [published]);
  // Products this customer received (order Delivered) and has not reviewed yet.
  const eligible = useMemo(() => {
    if (!user) return [];
    const out = [];
    allOrders.filter((o) => o.email === user.email && o.status === "Delivered").forEach((o) => o.items.forEach((it) => {
      const key = `${o.id}:${it.id}`;
      if (!reviews.some((r) => r.key === key)) out.push({ key, orderId: o.id, pid: it.id });
    }));
    return out;
  }, [user, allOrders, reviews]);
  const addReview = ({ key, pid, orderId, n, r, t, img }) => {
    if (!user || !eligible.some((e) => e.key === key)) { showToast("Only customers who received this watch can review it"); return false; }
    const rv = { id: "r" + Date.now().toString(36), key, pid, orderId, email: user.email, n, r, t, img: img || "", date: new Date().toISOString(), verified: true, status: REVIEWS_NEED_APPROVAL ? "pending" : "published" };
    setReviews((l) => [rv, ...l]);
    log(`New ${r}-star review for ${products[pid].n}`, user.email);
    showToast(REVIEWS_NEED_APPROVAL ? "Thank you! Your review will show once we have approved it." : "Thank you! Your review is now live.");
    return true;
  };
  const updateReview = (id, patch) => {
    setReviews((l) => l.map((x) => (x.id === id ? { ...x, ...patch, ...(REVIEWS_NEED_APPROVAL && !adm ? { status: "pending" } : {}) } : x)));
    showToast("Your review was updated");
  };
  const deleteReview = (id) => {
    const rv = reviews.find((x) => x.id === id);
    setReviews((l) => l.filter((x) => x.id !== id));
    if (rv) log(`Deleted a review of ${products[rv.pid].n}`, adm?.email || user?.email);
    showToast("Review deleted");
  };
  const setReviewStatus = (id, status) => {
    setReviews((l) => l.map((x) => (x.id === id ? { ...x, status } : x)));
    log(`${status === "published" ? "Published" : "Hid"} a review`);
    showToast(status === "published" ? "Review is now public" : "Review hidden from the store");
  };
  const replyReview = (id, text) => {
    setReviews((l) => l.map((x) => (x.id === id ? { ...x, reply: text.trim(), replyDate: new Date().toISOString() } : x)));
    showToast(text.trim() ? "Reply saved. It shows under the review." : "Reply removed");
  };
  const skipReview = (key) => { setSkipRev((l) => [...l, key]); showToast("OK, we will not ask about that order again"); };

  // ----- orders
  const placeOrder = ({ name, phone, cEmail, district, street, zi, pay, coupon, disc, payRef, payPhone, card }) => {
    const id = "DS-" + Math.floor(10000 + Math.random() * 89999);
    const fee = zones[zi].fee;
    const o = {
      id, email: user.email, date: new Date().toISOString(),
      items: cart.map((x) => ({ id: x.id, q: x.q, p: products[x.id].p })),
      sub: subtotal, disc, coupon, fee, total: Math.max(0, subtotal - disc) + fee,
      pay, name, phone, cEmail: cEmail || user.email, area: zones[zi].name, district, street, status: "Processing",
      payStatus: "Pending", payRef: payRef || "", payPhone: payPhone || "", card: card || null,
    };
    setAllOrders((a) => [o, ...a]);
    setProducts((ps) => ps.map((p) => {
      const it = cart.find((c) => c.id === p.id);
      return it ? { ...p, stock: Math.max(0, p.stock - it.q) } : p;
    }));
    setCart([]);
    log("New order " + id, user.email);
    showToast(`Order ${id} placed. Thank you!`);
    return id;
  };
  const setOrderStatus = (id, status) => {
    const o = allOrders.find((x) => x.id === id);
    if (!o) return;
    const old = o.status;
    setAllOrders((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    const move = (sign) => setProducts((ps) => ps.map((p) => {
      const it = o.items.find((i) => i.id === p.id);
      return it ? { ...p, stock: Math.max(0, p.stock + sign * it.q) } : p;
    }));
    if (status === "Cancelled" && old !== "Cancelled") move(1);
    if (old === "Cancelled" && status !== "Cancelled") move(-1);
    log(`Order ${id}: ${old} to ${status}`);
    showToast(status === "Delivered" ? "Order marked as delivered. The customer will be invited to review it." : "Status updated");
  };

  // ----- admin
  const setPayStatus = (id, payStatus) => {
    setAllOrders((a) => a.map((x) => (x.id === id ? { ...x, payStatus } : x)));
    log(`Payment for ${id}: ${payStatus}`);
    showToast("Payment status updated");
  };
  const saveVideos = (v) => { setVideos(v); log("Updated showcase videos"); showToast("Videos saved"); };
  const savePayCfg = (c) => { setPayCfg(c); log("Updated payment settings"); showToast("Payment settings saved"); };
  const adminSignIn = async (email, pw) => {
    const m = staff.find((x) => x.email === String(email).trim().toLowerCase() && x.active);
    const ok = !!m && (m.pwh ? m.pwh === await hashPw(m.salt, pw) : pw === DEMO_ADMIN_PASSWORD);
    if (!ok) { showToast("Email or password is incorrect"); return false; }
    setAdm({ email: m.email, name: m.name, role: m.role });
    log("Signed in", m.email);
    showToast(`Welcome back, ${m.name.split(" ")[0]}`);
    return true;
  };
  // ----- the signed-in admin's own account (Admin > Settings)
  const me = adm ? staff.find((x) => x.email === adm.email) || null : null;
  const updateAdminProfile = ({ name, email, phone = "", avatar = "" }) => {
    const em = String(email).trim().toLowerCase(), nm = String(name).trim();
    const i = staff.findIndex((x) => x.email === adm?.email);
    if (i < 0) return false;
    if (!nm) { showToast("Please enter your name"); return false; }
    if (!/^\S+@\S+\.\S+$/.test(em)) { showToast("Please enter a valid email address"); return false; }
    if (staff.some((x, k) => k !== i && x.email === em)) { showToast("That email is already used by another team member"); return false; }
    const next = { ...staff[i], name: nm, email: em, phone: String(phone).trim(), avatar };
    setStaff((l) => l.map((x, k) => (k === i ? next : x)));
    setAdm({ email: em, name: nm, role: next.role });
    log(em !== staff[i].email ? `Changed own profile and email to ${em}` : "Changed own profile", em);
    showToast("Profile updated");
    return true;
  };
  const changeAdminPassword = async (current, next) => {
    if (!me) return false;
    const okNow = me.pwh ? me.pwh === await hashPw(me.salt, current) : current === DEMO_ADMIN_PASSWORD;
    if (!okNow) { showToast("Your current password is not correct"); return false; }
    if (String(next).length < 8) { showToast("Choose a new password with at least 8 characters"); return false; }
    const salt = newSalt(), pwh = await hashPw(salt, next);
    setStaff((l) => l.map((x) => (x.email === me.email ? { ...x, pwh, salt } : x)));
    log("Changed own password", me.email);
    showToast("Password changed. Use it the next time you sign in.");
    return true;
  };
  const adminSignOut = () => { setAdm(null); showToast("Signed out of the admin area"); };
  const saveProduct = (prod) => {
    const isNew = prod.id >= products.length;
    setProducts((ps) => (isNew ? [...ps, prod] : ps.map((p) => (p.id === prod.id ? prod : p))));
    log((isNew ? "Added" : "Edited") + " product " + prod.n);
    showToast(isNew ? `${prod.n} was added to the store` : `${prod.n} was updated`);
  };
  const toggleProduct = (id) => {
    const p = products[id];
    setProducts((ps) => ps.map((x) => (x.id === id ? { ...x, active: x.active === false } : x)));
    log((p.active === false ? "Showed" : "Hid") + " product " + p.n);
    showToast(p.active === false ? `${p.n} is now visible in the store` : `${p.n} is now hidden from the store`);
  };
  const setStock = (id, n) => {
    const p = products[id];
    const stock = Math.max(0, n || 0);
    setProducts((ps) => ps.map((x) => (x.id === id ? { ...x, stock } : x)));
    log(`Stock of ${p.n}: ${p.stock} to ${stock}`);
    showToast("Stock updated");
  };
  // ----- categories (Admin > Categories)
  const addCategory = (name, img = "") => {
    const n = name.trim();
    if (!n) return false;
    if (cats.some((c) => c.name.toLowerCase() === n.toLowerCase())) { showToast("That category already exists"); return false; }
    setCats((l) => [...l, { name: n, img }]); log("Added category " + n); showToast("Category added"); return true;
  };
  const renameCategory = (i, name) => {
    const n = name.trim(), old = cats[i]?.name;
    if (!n || n === old) return false;
    if (cats.some((c, k) => k !== i && c.name.toLowerCase() === n.toLowerCase())) { showToast("That category already exists"); return false; }
    setCats((l) => l.map((c, k) => (k === i ? { ...c, name: n } : c)));
    setProducts((ps) => ps.map((p) => (p.c === old ? { ...p, c: n } : p)));
    log(`Renamed category ${old} to ${n}`); showToast("Category renamed"); return true;
  };
  const deleteCategory = (i) => {
    const c = cats[i];
    if (products.some((p) => p.c === c.name)) { showToast("Move this category's products to another category first"); return false; }
    setCats((l) => l.filter((_, k) => k !== i)); log("Deleted category " + c.name); showToast("Category deleted"); return true;
  };
  const moveCategory = (i, d) => setCats((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const a = [...l]; [a[i], a[j]] = [a[j], a[i]]; return a;
  });
  const setCategoryImage = (i, img) => {
    setCats((l) => l.map((c, k) => (k === i ? { ...c, img } : c))); log("Changed cover of category " + cats[i].name); showToast("Category photo saved");
  };
  const addCoupon = (c) => {
    if (coupons.some((x) => x.code === c.code)) { showToast("That code already exists"); return false; }
    setCoupons((l) => [c, ...l]); log("Created coupon " + c.code); showToast("Coupon created"); return true;
  };
  const toggleCoupon = (i) => {
    const c = coupons[i];
    setCoupons((l) => l.map((x, k) => (k === i ? { ...x, active: !x.active } : x)));
    log((c.active ? "Turned off" : "Turned on") + " coupon " + c.code);
    showToast(`Coupon ${c.code} turned ${c.active ? "off" : "on"}`);
  };
  const saveZones = (z) => { setZones(z); log("Updated shipping zones"); showToast("Shipping saved"); };
  const addStaff = (m) => {
    if (staff.some((x) => x.email === m.email)) { showToast("That email is already on the team"); return false; }
    setStaff((l) => [...l, m]); log("Added team member " + m.email); showToast("Team member added"); return true;
  };
  const setRole = (i, role) => {
    setStaff((l) => l.map((x, k) => (k === i ? { ...x, role } : x)));
    log(`Role of ${staff[i].email}: ${role}`); showToast("Role updated");
  };
  const toggleStaff = (i) => {
    setStaff((l) => l.map((x, k) => (k === i ? { ...x, active: !x.active } : x)));
    log((staff[i].active ? "Turned off " : "Turned on ") + staff[i].email);
    showToast(`${staff[i].name} ${staff[i].active ? "can no longer sign in" : "can sign in again"}`);
  };

  const value = {
    products, zones, coupons, staff, adm, audit, allOrders, theme, toast, payCfg, videos, saveVideos,
    cart, cartCount, subtotal, addToCart, changeQty, removeFromCart,
    user, signIn, signOut, updateProfile, wish, toggleWish, orders, addrs, saveAddr, deleteAddr,
    placeOrder, setOrderStatus, setPayStatus, savePayCfg, adminSignIn, adminSignOut, saveProduct, toggleProduct, setStock,
    addCoupon, toggleCoupon, saveZones, addStaff, setRole, toggleStaff,
    reviews, published, reviewStats, eligible, skipRev, addReview, updateReview, deleteReview, setReviewStatus, replyReview, skipReview,
    cats, addCategory, renameCategory, deleteCategory, moveCategory, setCategoryImage,
    me, updateAdminProfile, changeAdminPassword, axCol, setAxCol,
    showToast, hideToast, setTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
