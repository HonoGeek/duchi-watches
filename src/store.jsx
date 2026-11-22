import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ls, sv, hashPw, newSalt, fmt, isEmail, isPhone, normPhone, clean, isName, intIn } from "./lib";
import { orderMessage, waLink } from "./pay";
import { isMomo, isPaid } from "./orderState";
import { SEED_REVIEWS, REVIEWS_NEED_APPROVAL, SEED_PRODUCTS, SEED_CATS, SEED_ZONES, SEED_COUPONS, SEED_STAFF, SEED_PAYCFG, SEED_VIDEOS, DEMO_ADMIN_PASSWORD, PAY_STATUS, ST, livePays, DEFAULT_POLICIES, POLICY_KEYS, RETURN_REASONS } from "./data";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

// useState that also saves to localStorage. Swap this for API calls later.
function usePersist(key, init) {
  const [v, setV] = useState(() => ls(key, typeof init === "function" ? init() : init));
  useEffect(() => { sv(key, v); }, [key, v]);
  // The shop and the admin area are often open in two tabs. When the other tab changes this value, follow it,
  // otherwise this tab would later save its old copy over the change.
  useEffect(() => {
    const on = (e) => {
      if (e.storageArea !== localStorage || e.key !== key || e.newValue == null) return;
      try { const next = JSON.parse(e.newValue); setV((cur) => (JSON.stringify(cur) === e.newValue ? cur : next)); } catch { /* ignore */ }
    };
    addEventListener("storage", on);
    return () => removeEventListener("storage", on);
  }, [key]);
  return [v, setV];
}

export function StoreProvider({ children }) {
  const [products, setProducts] = usePersist("duchi-products", SEED_PRODUCTS);
  const [cats, setCats] = usePersist("duchi-cats", SEED_CATS);
  const [reviews, setReviews] = usePersist("duchi-reviews", SEED_REVIEWS);
  const [skipRev, setSkipRev] = usePersist("duchi-review-skip", []); // "Don't ask again" choices
  const [cart, setCart] = usePersist("duchi-cart", []);
  const [guestWish, setGuestWish] = usePersist("duchi-wish", []);          // the list of someone who is not signed in
  const [wishMap, setWishMap] = usePersist("duchi-wishlists", {});         // one list per account
  const [user, setUser] = usePersist("duchi-user", null);
  const [users, setUsers] = usePersist("duchi-users", {});
  const [allOrders, setAllOrders] = usePersist("duchi-all", []);
  const [addrMap, setAddrMap] = usePersist("duchi-addrs", {});
  const [zones, setZones] = usePersist("duchi-zones", SEED_ZONES);
  const [coupons, setCoupons] = usePersist("duchi-coupons", SEED_COUPONS);
  const [staff, setStaff] = usePersist("duchi-staff", SEED_STAFF);
  const [payCfg, setPayCfg] = usePersist("duchi-paycfg", SEED_PAYCFG);
  const [videos, setVideos] = usePersist("duchi-videos", SEED_VIDEOS);
  const [messages, setMessages] = usePersist("duchi-messages", []);       // Contact page messages
  const [policiesRaw, setPolicies] = usePersist("duchi-policies", DEFAULT_POLICIES);   // written by the owner in Admin > Policies
  const policies = useMemo(() => ({ ...DEFAULT_POLICIES, ...policiesRaw }), [policiesRaw]);
  const [notifs, setNotifs] = usePersist("duchi-notifs", []);             // notes for customers about their orders (the bell)
  const [subsRaw, setSubs] = usePersist("duchi-subscribers", []);           // newsletter sign-ups
  // Older sign-ups were saved as plain email strings without a date: show them as { email, date: "" }.
  const subscribers = useMemo(() => subsRaw.map((s) => (typeof s === "string" ? { email: s, date: "" } : s)), [subsRaw]);
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
    timer.current = setTimeout(() => setToast(null), opts.ms || (opts.action ? 7000 : 4000));
  };
  // ask("Delete this?", () => doIt(), { yes: "Yes, delete", no: "No" }) shows a question in the toast with two buttons.
  // Nothing happens until the person presses the first one. The toast goes away by itself after 12 seconds, which counts as "No".
  const ask = (msg, onYes, { yes = "Yes", no = "No" } = {}) => {
    showToast(msg, { type: "ask", label: yes, no, ms: 12000, action: () => { hideToast(); onYes(); } });
  };
  const bad = (msg, ret = false) => { showToast(msg, { type: "err" }); return ret; }; // shows a problem and gives back false (or null)
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

  // ----- products are found by their id (a database id later), never by their place in the list
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const getProduct = (id) => byId.get(id) ?? byId.get(Number(id)); // route parameters arrive as text
  const nextProductId = products.reduce((m, p) => Math.max(m, p.id), -1) + 1;
  // A product that no longer exists is quietly dropped from the cart and the wishlist.
  useEffect(() => { if (cart.some((x) => !byId.has(x.id))) setCart((c) => c.filter((x) => byId.has(x.id))); }, [byId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- cart
  const subtotal = useMemo(() => cart.reduce((a, x) => a + (byId.get(x.id)?.p || 0) * x.q, 0), [cart, byId]);
  const cartCount = cart.reduce((a, x) => a + x.q, 0);
  // Adds to the cart and shows a toast that names the product and how many were added.
  // Pass { silent: true } when the caller shows its own summary toast (e.g. "Buy again").
  const addToCart = (id, q = 1, { silent = false } = {}) => {
    const p = getProduct(id);
    if (!p || p.active === false) { showToast("This watch is not available right now", { type: "err" }); return false; }
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
    const p = getProduct(id);
    if (d > 0 && p && x.q + d > p.stock) { showToast(`Only ${p.stock} × ${p.n} in stock`); return; }
    setCart((c) => c.map((y) => (y.id === id ? { ...y, q: Math.max(1, y.q + d) } : y)));
  };
  const removeFromCart = (id) => {
    const x = cart.find((c) => c.id === id);
    setCart((c) => c.filter((y) => y.id !== id));
    const nm = getProduct(id)?.n || "The watch";
    if (x) showToast(`${nm} removed from your cart`, {
      label: "Undo", action: () => { setCart((c) => (c.some((y) => y.id === id) ? c : [...c, x])); showToast(`${nm} is back in your cart`); },
    });
  };

  // ----- customer account
  // Returns { ok: true } or { ok: false, error }. Passwords are kept as a salted hash, never as plain text.
  const signIn = async ({ email, name, phone, pw, register }) => {
    const fail = (error) => ({ ok: false, error });
    const em = String(email ?? "").trim().toLowerCase();
    if (!isEmail(em)) return fail("Enter a valid email address.");
    if (String(pw ?? "").length < 8) return fail("Your password needs at least 8 characters.");
    const found = users[em];
    const wrong = "Email or password is incorrect. New here? Choose Create account.";
    let rec;
    if (register) {
      if (!isName(name)) return fail("Enter your full name.");
      if (!isPhone(phone)) return fail("Enter a valid phone number, for example 0788 123 456.");
      if (found) return fail("An account with this email already exists. Choose Sign in instead.");
      const salt = newSalt();
      rec = { name: clean(name), email: em, phone: normPhone(phone), salt, pwh: await hashPw(salt, pw) };
    } else {
      if (!found) return fail(wrong);
      if (found.pwh) {
        if (found.pwh !== await hashPw(found.salt, pw)) return fail(wrong);
        rec = found;
      } else { // an account made before passwords existed: the password typed now becomes its password
        const salt = newSalt();
        rec = { ...found, salt, pwh: await hashPw(salt, pw) };
      }
    }
    setUsers((m) => ({ ...m, [em]: rec }));
    const { pwh, salt, ...pub } = rec; // the signed-in session never holds the password hash
    setUser(pub);
    showToast(`Welcome${register ? "" : " back"}, ${pub.name.split(" ")[0]}`);
    return { ok: true };
  };
  const signOut = () => { setUser(null); showToast("You have signed out"); };
  const updateProfile = (name, phone) => {
    if (!isName(name)) return bad("Enter your full name");
    if (String(phone ?? "").trim() && !isPhone(phone)) return bad("Enter a valid phone number, for example 0788 123 456");
    const u = { ...user, name: clean(name), phone: String(phone ?? "").trim() ? normPhone(phone) : "" };
    setUser(u);
    setUsers((m) => ({ ...m, [u.email]: { ...m[u.email], ...u } }));
    showToast("Profile saved");
    return true;
  };
  const changePassword = async (current, next) => {
    const rec = user && users[user.email];
    if (!rec) return false;
    if (rec.pwh && rec.pwh !== await hashPw(rec.salt, current)) return bad("Your current password is not correct");
    if (String(next).length < 8) return bad("Choose a new password with at least 8 characters");
    if (next === current) return bad("Please choose a password you have not used before");
    const salt = newSalt(), pwh = await hashPw(salt, next);
    setUsers((m) => ({ ...m, [user.email]: { ...rec, salt, pwh } }));
    showToast("Password changed. Use it the next time you sign in.");
    return true;
  };
  const wish = useMemo(() => (user ? wishMap[user.email] || [] : guestWish).filter((id) => byId.has(id)), [user, wishMap, guestWish, byId]);
  const setWish = (fn) => (user ? setWishMap((m) => ({ ...m, [user.email]: fn(m[user.email] || []) })) : setGuestWish(fn));
  // Hearts saved before signing in (or before wishlists belonged to accounts) join the account's list.
  useEffect(() => {
    if (!user || !guestWish.length) return;
    setWishMap((m) => ({ ...m, [user.email]: [...new Set([...(m[user.email] || []), ...guestWish])] }));
    setGuestWish([]);
  }, [user?.email, guestWish.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleWish = (id) => {
    const on = wish.includes(id);
    setWish((w) => (on ? w.filter((x) => x !== id) : [...w, id]));
    showToast(on ? `${getProduct(id)?.n} removed from your wishlist` : `${getProduct(id)?.n} saved to your wishlist`);
  };
  const orders = useMemo(() => (user ? allOrders.filter((o) => o.email === user.email) : []), [allOrders, user]);
  const addrs = user ? addrMap[user.email] || [] : [];
  const saveAddr = (a, index) => {
    const addr = { label: clean(a.label), name: clean(a.name), phone: normPhone(a.phone), zone: Number(a.zone), district: clean(a.district), street: clean(a.street) };
    if (!addr.label) return bad("Give the address a short label, for example Home");
    if (!isName(addr.name)) return bad("Enter the full name for this address");
    if (!isPhone(a.phone)) return bad("Enter a valid phone number, for example 0788 123 456");
    if (!zones[addr.zone]) return bad("Choose a delivery area");
    if (addr.district.length < 2) return bad("Enter the district");
    if (addr.street.length < 3) return bad("Enter the street and a landmark");
    if (index == null && addrs.length >= 10) return bad("You can save up to 10 addresses. Delete one to add another.");
    const list = [...addrs];
    index != null ? (list[index] = addr) : list.push(addr);
    setAddrMap((m) => ({ ...m, [user.email]: list }));
    showToast("Address saved");
    return true;
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
    log(`New ${r}-star review for ${getProduct(pid)?.n || "a watch"}`, user.email);
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
    if (rv) log(`Deleted a review of ${getProduct(rv.pid)?.n || "a watch"}`, adm?.email || user?.email);
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
  // Returns the new order id, or null (with a message) when something is wrong. The discount is worked out here from the coupon code.
  const placeOrder = ({ name, phone, cEmail, district, street, zi, pay, coupon, payRef, payPhone, card }) => {
    if (!user) return bad("Please sign in to place your order", null);
    if (!cart.length) return bad("Your cart is empty", null);
    if (!isName(name)) return bad("Enter the full name for delivery", null);
    if (!isPhone(phone)) return bad("Enter a valid phone number, for example 0788 123 456", null);
    if (!isEmail(cEmail)) return bad("Enter a valid email address", null);
    if (clean(district).length < 2) return bad("Enter the district", null);
    if (clean(street).length < 5) return bad("Enter the delivery address: sector, street and a landmark", null);
    const zone = zones[zi];
    if (!zone) return bad("Choose a delivery area", null);
    if (!livePays().includes(pay)) return bad(pay === "Card" ? "Card payments are not available yet. Please choose another payment method." : "Choose a payment method", null);
    const momo = pay === "MTN Mobile Money" || pay === "Airtel Money";
    if (momo && !payPhone) return bad("Enter the number you paid from, so we can match your payment", null);
    if (momo && !isPhone(payPhone)) return bad("The number you paid from does not look right", null);
    if (payRef && !/^[A-Za-z0-9._-]{4,40}$/.test(payRef)) return bad("The transaction ID can only use letters and numbers (4 to 40 characters)", null);
    for (const x of cart) { // stock can change while a customer is checking out
      const p = getProduct(x.id);
      if (!p || p.active === false) return bad(`${p?.n || "A watch"} is no longer available. Please remove it from your cart.`, null);
      if (x.q > p.stock) return bad(p.stock <= 0 ? `${p.n} just sold out. Please remove it from your cart.` : `Only ${p.stock} × ${p.n} left in stock. Please lower the quantity in your cart.`, null);
    }
    const c = coupon ? coupons.find((k) => k.active && k.code === String(coupon).toUpperCase()) : null;
    if (coupon && !c) return bad("That coupon is no longer valid", null);
    const disc = c ? (c.type === "pct" ? Math.round((subtotal * c.val) / 100) : Math.min(c.val, subtotal)) : 0;
    let id;
    do { id = "DS-" + Math.floor(10000 + Math.random() * 89999); } while (allOrders.some((x) => x.id === id));
    const fee = zone.fee;
    const o = {
      id, email: user.email, date: new Date().toISOString(),
      items: cart.map((x) => { const p = getProduct(x.id); return { id: x.id, q: x.q, p: p.p, n: p.n, c: p.c }; }), // the price, name and category as they were when the customer ordered
      sub: subtotal, disc, coupon: c ? c.code : null, fee, total: Math.max(0, subtotal - disc) + fee,
      pay, name: clean(name), phone: normPhone(phone), cEmail: String(cEmail).trim().toLowerCase(), area: zone.name, district: clean(district), street: clean(street), status: "Processing",
      payStatus: "Pending", payRef: pay === "Bank transfer" ? "" : payRef || "", payPhone: momo ? normPhone(payPhone) : "", card: pay === "Card" ? card || null : null,
    };
    setAllOrders((a) => [o, ...a]);
    setProducts((ps) => ps.map((p) => {
      const it = cart.find((k) => k.id === p.id);
      return it ? { ...p, stock: Math.max(0, p.stock - it.q) } : p;
    }));
    setCart([]);
    log("New order " + id, user.email);
    showToast(`Order ${id} placed. Thank you!`);
    return id;
  };
  // ----- customer notifications: when an order changes, its customer gets a note in the bell
  const localNotifs = useRef(new Set()); // notes made in this tab, so this tab does not pop up a toast for the admin's own action
  const pushNotif = (o, kind, title, text) => {
    const n = { id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), email: o.email, orderId: o.id, kind, title, text, date: new Date().toISOString(), read: false };
    localNotifs.current.add(n.id);
    setNotifs((l) => [n, ...l].slice(0, 300));
  };
  const ORDER_NOTES = {
    Dispatched: ["is on its way", "Your order has been dispatched and is on its way to you."],
    Delivered: ["has been delivered", "Your order has arrived. We would love to hear how you like it: a short review helps other buyers."],
    Cancelled: ["was cancelled", "Your order was cancelled. If you have a question about it, please contact us."],
  };
  const myNotifs = useMemo(() => (user ? notifs.filter((n) => n.email === user.email) : []), [notifs, user]);
  const readNotif = (id) => setNotifs((l) => l.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n)));
  const readOrderNotifs = (orderId) => setNotifs((l) => l.map((n) => (user && n.email === user.email && n.orderId === orderId && !n.read ? { ...n, read: true } : n)));
  const readAllNotifs = () => setNotifs((l) => l.map((n) => (user && n.email === user.email && !n.read ? { ...n, read: true } : n)));
  // A new note that arrives while the customer has the shop open (for example from another tab) also shows as a toast.
  const seenNotifs = useRef(null);
  useEffect(() => {
    const ids = new Set(myNotifs.map((n) => n.id));
    const prev = seenNotifs.current;
    seenNotifs.current = { email: user?.email, ids };
    if (!prev || prev.email !== user?.email) return; // first load or a different customer: nothing to announce
    const fresh = myNotifs.find((n) => !n.read && !prev.ids.has(n.id) && !localNotifs.current.has(n.id));
    if (fresh) showToast(fresh.title, { to: `/account/orders/${fresh.orderId}`, label: "View" });
  }, [myNotifs]); // eslint-disable-line react-hooks/exhaustive-deps

  // opts.by "customer": the customer did this themselves, so no notice goes to them and no WhatsApp offer to the admin. opts.patch adds fields to the order.
  const setOrderStatus = (id, status, opts = {}) => {
    const o = allOrders.find((x) => x.id === id);
    if (!o || !ST.includes(status) || o.status === status) return;
    const old = o.status, now = new Date().toISOString();
    setAllOrders((a) => a.map((x) => (x.id === id ? {
      ...x, status,
      ...(status === "Delivered" ? { deliveredAt: now } : {}),
      ...(status === "Cancelled" ? { restockedAt: now } : {}),                                  // the watches go back into stock automatically
      ...(old === "Cancelled" ? { restockedAt: null, cancelledBy: null, refundCheck: null } : {}), // reopened: they are taken out again
      ...(opts.patch || {}),
    } : x)));
    const move = (sign) => setProducts((ps) => ps.map((p) => {
      const it = o.items.find((i) => i.id === p.id);
      return it ? { ...p, stock: Math.max(0, p.stock + sign * it.q) } : p;
    }));
    if (status === "Cancelled" && old !== "Cancelled") move(1);
    if (old === "Cancelled" && status !== "Cancelled") move(-1);
    log(`Order ${id}: ${old} to ${status}`, opts.by === "customer" ? user?.email : undefined);
    if (opts.by === "customer") return;
    if (ORDER_NOTES[status]) pushNotif(o, status.toLowerCase(), `Order ${id} ${ORDER_NOTES[status][0]}`, ORDER_NOTES[status][1]);
    else if (status === "Processing" && old === "Cancelled") pushNotif(o, "processing", `Order ${id} is being prepared again`, "Your order was reopened and we are getting it ready.");
    const msg = status === "Delivered" ? "Order marked as delivered. The customer will be invited to review it." : "Status updated";
    // For the steps the customer cares about, offer a ready-to-send WhatsApp message (no server needed: it opens WhatsApp with the text typed in)
    if (["Dispatched", "Delivered", "Cancelled"].includes(status)) showToast(msg, { label: "WhatsApp customer", action: () => window.open(waLink(o.phone, orderMessage({ ...o, status })), "_blank", "noopener") });
    else showToast(msg);
  };

  // ----- what a customer can do about an order, and how the admin answers
  const patchOrder = (id, patch) => setAllOrders((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const myOrder = (id) => (user ? allOrders.find((x) => x.id === id && x.email === user.email) : undefined);
  const isPaidO = (o) => (o.payStatus || "Pending") === "Paid";
  const longText = (v, min, max, what) => {
    const t = clean(v);
    if (t.length < min) return bad(`${what} (at least ${min} characters)`);
    if (t.length > max) return bad(`Please keep it under ${max} characters`);
    return t;
  };

  // A customer asks to cancel an order that is still Processing. Nothing is cancelled until the admin agrees.
  const requestCancel = (id, reason) => {
    const o = myOrder(id);
    if (!o) return bad("We could not find that order");
    if (o.status !== "Processing") return bad("This order can no longer be cancelled online. Please contact us.");
    if (o.cancelReq?.status === "pending") return bad("You already asked to cancel this order. We will answer soon.");
    const why = longText(reason, 5, 300, "Please tell us briefly why you want to cancel");
    if (why === false) return false;
    patchOrder(id, { cancelReq: { date: new Date().toISOString(), reason: why, status: "pending" } });
    log(`Cancellation requested for order ${id}`, user.email);
    showToast("Your request was sent. We will answer as soon as we can.");
    return true;
  };
  // An order that is still Processing with no confirmed payment can be cancelled by the customer straight away.
  // A paid order needs the admin to agree first (requestCancel). Mobile money is flagged for a payment check: the customer
  // normally pays before placing the order, so money may have arrived even though nobody confirmed it yet.
  const cancelOwnOrder = (id) => {
    const o = myOrder(id);
    if (!o) return bad("We could not find that order");
    if (o.status !== "Processing") return bad("This order can no longer be cancelled online. Please contact us.");
    if (isPaid(o)) return bad("This order is paid, so we need to check it first. Please send a cancellation request.");
    const now = new Date().toISOString();
    setOrderStatus(id, "Cancelled", {
      by: "customer",
      patch: { cancelledBy: "customer", cancelledAt: now, ...(isMomo(o) ? { refundCheck: "check" } : {}),
        ...(o.cancelReq?.status === "pending" ? { cancelReq: { ...o.cancelReq, status: "approved", answer: "Cancelled by the customer", answeredAt: now } } : {}) },
    });
    showToast(isMomo(o) ? "Your order was cancelled. If you already sent money, we will check our records and contact you about your refund." : "Your order was cancelled.");
    return true;
  };
  const answerCancel = (id, approve, answer = "") => {
    const o = allOrders.find((x) => x.id === id);
    if (!o || o.cancelReq?.status !== "pending") return bad("There is no open cancellation request for this order");
    const text = clean(answer);
    if (!approve && text.length < 5) return bad("Tell the customer why you are declining (at least 5 characters)");
    patchOrder(id, { cancelReq: { ...o.cancelReq, status: approve ? "approved" : "declined", answer: text, answeredAt: new Date().toISOString() } });
    if (approve) { setOrderStatus(id, "Cancelled"); return true; } // puts the watches back in stock and tells the customer
    pushNotif(o, "declined", `Cancellation request for order ${id} was declined`, text);
    log(`Declined the cancellation request for order ${id}`);
    showToast("Request declined. The customer was told.");
    return true;
  };

  // A customer whose payment was not confirmed (or who paid another way) sends the payment details again.
  const updateOrderPayment = (id, { pay, payPhone, payRef }) => {
    const o = myOrder(id);
    if (!o) return bad("We could not find that order");
    if (!["Processing", "Dispatched"].includes(o.status)) return bad("Payment details can only be changed while the order is open");
    if (isPaidO(o)) return bad("This order is already paid");
    if (pay === "Card" || !livePays().includes(pay)) return bad(pay === "Card" ? "Card payments are not available yet. Please choose another payment method." : "Choose a payment method");
    const momo = pay === "MTN Mobile Money" || pay === "Airtel Money";
    if (momo && !String(payPhone ?? "").trim()) return bad("Enter the number you paid from, so we can match your payment");
    if (momo && !isPhone(payPhone)) return bad("The number you paid from does not look right");
    const ref = String(payRef ?? "").trim();
    if (momo && ref && !/^[A-Za-z0-9]{4,40}$/.test(ref)) return bad("The transaction ID uses letters and numbers only (4 to 40 characters)");
    patchOrder(id, { pay, payPhone: momo ? normPhone(payPhone) : "", payRef: momo ? ref : "", payStatus: "Pending", card: null, payUpdatedAt: new Date().toISOString() });
    log(`Customer sent payment details for order ${id}: ${pay}`, user.email);
    showToast("Payment details saved. We will check your payment and let you know.");
    return true;
  };

  // Returns need a return period set in Admin > Policies (0 = not open), and only count for delivered orders inside that period.
  const requestReturn = (id, { reason, note }) => {
    const o = myOrder(id);
    if (!o) return bad("We could not find that order");
    if (o.status !== "Delivered") return bad("Only a delivered order can be returned");
    const days = policies.returnDays;
    if (!days) return bad("Online return requests are not open yet. Please contact us.");
    if ((Date.now() - new Date(o.deliveredAt || o.date).getTime()) / 864e5 > days) return bad(`The ${days}-day return period for this order has ended. Please contact us.`);
    if (o.returnReq) return bad("A return request already exists for this order. Please contact us if you have a question.");
    if (!RETURN_REASONS.includes(reason)) return bad("Choose a reason for the return");
    const n = clean(note);
    if (n.length > 300) return bad("Please keep the note under 300 characters");
    patchOrder(id, { returnReq: { date: new Date().toISOString(), reason, note: n, status: "pending" } });
    log(`Return requested for order ${id}`, user.email);
    showToast("Your return request was sent. We will answer as soon as we can.");
    return true;
  };
  // status: "approved" or "declined" for a new request, then "refunded" once the money has been sent back by hand.
  const answerReturn = (id, status, { answer = "", amount, method = "" } = {}) => {
    const o = allOrders.find((x) => x.id === id);
    const rr = o?.returnReq;
    if (!rr) return bad("There is no return request for this order");
    const text = clean(answer), now = new Date().toISOString();
    if (status === "approved" || status === "declined") {
      if (rr.status !== "pending") return bad("This request was already answered");
      if (status === "declined" && text.length < 5) return bad("Tell the customer why you are declining (at least 5 characters)");
      patchOrder(id, { returnReq: { ...rr, status, answer: text, answeredAt: now } });
      if (status === "approved") pushNotif(o, "approved", `Return request for order ${id} approved`, text || "We approved your return request. We will contact you about the next steps.");
      else pushNotif(o, "declined", `Return request for order ${id} was declined`, text);
      log(`${status === "approved" ? "Approved" : "Declined"} the return request for order ${id}`);
      showToast(status === "approved" ? "Return approved. The customer was told." : "Return declined. The customer was told.");
      return true;
    }
    if (status === "refunded") {
      if (rr.status !== "approved") return bad("Approve the return before recording a refund");
      const amt = intIn(amount, 1, o.total);
      if (amt == null) return bad(`Enter the refund as a whole number of RWF, up to ${fmt(o.total)}`);
      const how = clean(method).slice(0, 100);
      patchOrder(id, { returnReq: { ...rr, status: "refunded", refund: { amount: amt, method: how, date: now } } });
      pushNotif(o, "refunded", `Refund recorded for order ${id}`, `We recorded a refund of ${fmt(amt)}${how ? ` (${how})` : ""}.`);
      log(`Refund of ${fmt(amt)} recorded for order ${id}`);
      showToast("Refund recorded. The customer was told.");
      return true;
    }
    return false;
  };

  // ----- the admin's manual control of money and stock after a cancellation or a return
  // A cancelled order whose payment may have arrived: record the refund once the money was sent back, or say that nothing is owed.
  const recordCancelRefund = (id, { amount, method = "" }) => {
    const o = allOrders.find((x) => x.id === id);
    if (!o || o.status !== "Cancelled") return bad("A refund can only be recorded on a cancelled order");
    if (o.refund) return bad("A refund is already recorded for this order");
    const amt = intIn(amount, 1, o.total);
    if (amt == null) return bad(`Enter the refund as a whole number of RWF, up to ${fmt(o.total)}`);
    const how = clean(method).slice(0, 100);
    patchOrder(id, { refund: { amount: amt, method: how, date: new Date().toISOString() }, refundCheck: "refunded" });
    pushNotif(o, "refunded", `Refund recorded for order ${id}`, `We recorded a refund of ${fmt(amt)}${how ? ` (${how})` : ""}.`);
    log(`Refund of ${fmt(amt)} recorded for cancelled order ${id}`);
    showToast("Refund recorded. The customer was told.");
    return true;
  };
  const dismissRefundCheck = (id) => {
    const o = allOrders.find((x) => x.id === id);
    if (!o || o.status !== "Cancelled" || o.refund) return false;
    patchOrder(id, { refundCheck: "none" });
    log(`No refund needed for cancelled order ${id}`);
    showToast("Saved. Nothing is owed on this order.");
    return true;
  };
  // A returned watch goes back on sale only when the admin says so (it may be damaged). restock: true adds the quantities to the stock.
  const restockReturn = (id, restock) => {
    const o = allOrders.find((x) => x.id === id);
    const rr = o?.returnReq;
    if (!rr || !["approved", "refunded"].includes(rr.status)) return bad("Approve the return first");
    if (rr.restock) return bad("The stock decision for this return was already made");
    if (restock) setProducts((ps) => ps.map((p) => { const it = o.items.find((i) => i.id === p.id); return it ? { ...p, stock: p.stock + it.q, ...stamp() } : p; }));
    patchOrder(id, { returnReq: { ...rr, restock: restock ? "yes" : "no", restockedAt: new Date().toISOString() } });
    log(restock ? `Returned watches of order ${id} put back in stock` : `Returned watches of order ${id} not put back in stock`);
    showToast(restock ? "Put back in stock." : "Saved. The returned watches were not added to the stock.");
    return true;
  };

  // ----- policies written by the owner (Help page, Terms, Privacy, the home page questions)
  const savePolicies = (p) => {
    const days = intIn(p.returnDays, 0, 90);
    if (days == null) return bad("The return period is a whole number of days from 0 to 90");
    const out = { returnDays: days };
    for (const [k, label] of POLICY_KEYS) {
      const paras = (Array.isArray(p[k]) ? p[k] : String(p[k] ?? "").split(/\r?\n/)).map(clean).filter(Boolean);
      if (paras.length > 20) return bad(`${label}: please keep it to 20 paragraphs or fewer`);
      if (paras.some((t) => t.length > 1000)) return bad(`${label}: each paragraph can have up to 1,000 characters`);
      out[k] = paras;
    }
    setPolicies(out); log("Updated the policies"); showToast("Policies saved");
    return true;
  };

  // ----- contact messages (Contact page to Admin > Messages)
  const addMessage = ({ name, email, phone, text }) => {
    const em = String(email ?? "").trim().toLowerCase();
    if (!isName(name) || !isEmail(em) || String(text ?? "").trim().length < 10 || (String(phone ?? "").trim() && !isPhone(phone))) return false;
    if (messages.filter((x) => x.email === em && Date.now() - new Date(x.date) < 10 * 60 * 1000).length >= 3) {
      return bad("You have sent a few messages already. Please wait a few minutes before sending another.");
    }
    const m = {
      id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: clean(name), email: em, phone: String(phone || "").trim() ? normPhone(phone) : "", text: String(text).trim(),
      date: new Date().toISOString(), read: false,
    };
    setMessages((l) => [m, ...l]);
    log(`New message from ${m.name}`, m.email);
    return true;
  };
  const setMessageRead = (id, read, silent = false) => {
    setMessages((l) => l.map((x) => (x.id === id ? { ...x, read } : x)));
    if (!silent) showToast(read ? "Message marked as read" : "Message marked as unread");
  };
  const deleteMessage = (id) => {
    const m = messages.find((x) => x.id === id);
    setMessages((l) => l.filter((x) => x.id !== id));
    if (m) log(`Deleted a message from ${m.name}`);
    showToast("Message deleted");
  };

  // ----- email list (Home page sign-up form to Admin > Email list)
  // Returns "added" or "exists". To email real subscribers, also send the address to your mailing service here.
  const addSubscriber = (email) => {
    const v = String(email).trim().toLowerCase();
    if (!isEmail(v)) return "invalid";
    if (subscribers.some((s) => s.email.toLowerCase() === v)) return "exists";
    setSubs([...subscribers, { email: v, date: new Date().toISOString() }]);
    return "added";
  };
  const removeSubscriber = (email) => {
    setSubs(subscribers.filter((s) => s.email !== email));
    log(`Removed ${email} from the email list`);
    showToast("Removed from the email list");
  };

  // ----- admin
  const setPayStatus = (id, payStatus) => {
    const o = allOrders.find((x) => x.id === id);
    if (!o || !PAY_STATUS.includes(payStatus) || (o.payStatus || "Pending") === payStatus) return;
    if (payStatus === "Paid") pushNotif(o, "paid", `Payment received for order ${id}`, "Thank you. We have confirmed your payment and will prepare your order.");
    if (payStatus === "Failed") pushNotif(o, "failed", `We could not confirm your payment for order ${id}`, "Please contact us so we can help you complete the payment.");
    setAllOrders((a) => a.map((x) => (x.id === id ? { ...x, payStatus } : x)));
    log(`Payment for ${id}: ${payStatus}`);
    showToast("Payment status updated");
  };
  const saveVideos = (v) => { setVideos(v); log("Updated showcase videos"); showToast("Videos saved"); };
  const savePayCfg = (c) => {
    const out = {};
    for (const [net, label] of [["mtn", "MTN Mobile Money"], ["airtel", "Airtel Money"]]) {
      const code = String(c[net]?.code ?? "").trim(), tpl = String(c[net]?.tpl ?? "").trim();
      if (!/^\d{3,12}$/.test(code)) return bad(`${label}: the merchant code should be 3 to 12 digits`);
      // a dial code: starts with *, ends with #, and only has digits, * and the {code} and {amount} placeholders
      if (!/^\*(?:[0-9*]|\{code\}|\{amount\})+#$/.test(tpl)) return bad(`${label}: the dial code should look like *182*8*1*{code}# (start with *, end with #)`);
      out[net] = { code, tpl };
    }
    setPayCfg(out); log("Updated payment settings"); showToast("Payment settings saved");
    return true;
  };
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
    const em = String(email).trim().toLowerCase(), nm = clean(name);
    const i = staff.findIndex((x) => x.email === adm?.email);
    if (i < 0) return false;
    if (!isName(nm)) return bad("Please enter your name (at least 2 characters)");
    if (!isEmail(em)) return bad("Please enter a valid email address");
    if (String(phone).trim() && !isPhone(phone)) return bad("Enter a valid phone number, for example 0788 123 456, or leave it empty");
    if (staff.some((x, k) => k !== i && x.email === em)) { showToast("That email is already used by another team member"); return false; }
    const next = { ...staff[i], name: nm, email: em, phone: String(phone).trim() ? normPhone(phone) : "", avatar };
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
  // Products carry createdAt, updatedAt (milliseconds) and updatedBy. Demo products from before this have none.
  const stamp = () => ({ updatedAt: Date.now(), updatedBy: adm?.name || "" });
  const saveProduct = (prod) => {
    if (!clean(prod.n) || !clean(prod.s)) return bad("A product needs a name and a dial or colour");
    if (!Number.isInteger(prod.p) || prod.p < 1) return bad("The price must be a whole number of RWF above 0");
    if (!Number.isInteger(prod.stock) || prod.stock < 0) return bad("Stock must be a whole number, 0 or more");
    const isNew = !byId.has(prod.id);
    const now = Date.now();
    setProducts((ps) => (isNew
      ? [...ps, { ...prod, createdAt: now, updatedAt: now, updatedBy: adm?.name || "" }]
      : ps.map((p) => (p.id === prod.id ? { ...p, ...prod, ...stamp() } : p))));
    log((isNew ? "Added" : "Edited") + " product " + prod.n);
    showToast(isNew ? `${prod.n} was added to the store` : `${prod.n} was updated`);
    return true;
  };
  const toggleProduct = (id) => {
    const p = getProduct(id);
    if (!p) return;
    setProducts((ps) => ps.map((x) => (x.id === id ? { ...x, active: x.active === false, ...stamp() } : x)));
    log((p.active === false ? "Showed" : "Hid") + " product " + p.n);
    showToast(p.active === false ? `${p.n} is now visible in the store` : `${p.n} is now hidden from the store`);
  };
  const setStock = (id, n) => {
    const p = getProduct(id);
    if (!p) return false;
    if (!Number.isInteger(n) || n < 0 || n > 100000) return bad("Stock must be a whole number from 0 to 100,000");
    const stock = n;
    setProducts((ps) => ps.map((x) => (x.id === id ? { ...x, stock, ...stamp() } : x)));
    log(`Stock of ${p.n}: ${p.stock} to ${stock}`);
    showToast("Stock updated");
    return true;
  };
  // ----- categories (Admin > Categories)
  const addCategory = (name, img = "") => {
    const n = clean(name);
    if (n.length < 2) return bad("Category names need at least 2 characters");
    if (cats.some((c) => c.name.toLowerCase() === n.toLowerCase())) { showToast("That category already exists"); return false; }
    setCats((l) => [...l, { name: n, img }]); log("Added category " + n); showToast("Category added"); return true;
  };
  const renameCategory = (i, name) => {
    const n = clean(name), old = cats[i]?.name;
    if (n === old) return false;
    if (n.length < 2) return bad("Category names need at least 2 characters");
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
    const code = String(c.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return bad("A coupon code needs 3 to 20 letters or numbers, with no spaces");
    if (c.type !== "pct" && c.type !== "fix") return bad("Choose a discount type");
    const val = intIn(c.val, 1, c.type === "pct" ? 100 : 10000000);
    if (val == null) return bad(c.type === "pct" ? "A percent discount must be a whole number from 1 to 100" : "A fixed discount must be a whole number of RWF above 0");
    if (coupons.some((x) => x.code === code)) { showToast("That code already exists"); return false; }
    setCoupons((l) => [{ code, type: c.type, val, active: true }, ...l]); log("Created coupon " + code); showToast("Coupon created"); return true;
  };
  const toggleCoupon = (i) => {
    const c = coupons[i];
    setCoupons((l) => l.map((x, k) => (k === i ? { ...x, active: !x.active } : x)));
    log((c.active ? "Turned off" : "Turned on") + " coupon " + c.code);
    showToast(`Coupon ${c.code} turned ${c.active ? "off" : "on"}`);
  };
  const saveZones = (z) => {
    if (!z.length) return bad("Keep at least one delivery zone");
    const out = [], seen = new Set();
    for (const r of z) {
      const name = clean(r.name), fee = intIn(r.fee, 0, 1000000);
      if (!name) return bad("Every zone needs a name");
      if (seen.has(name.toLowerCase())) return bad(`There are two zones called "${name}". Give each zone its own name.`);
      if (fee == null) return bad(`Enter the fee for ${name} as a whole number of RWF (0 or more)`);
      seen.add(name.toLowerCase()); out.push({ name, fee });
    }
    setZones(out); log("Updated shipping zones"); showToast("Shipping saved");
    return true;
  };
  const addStaff = (m) => {
    const name = clean(m.name), email = String(m.email ?? "").trim().toLowerCase();
    if (!isName(name)) return bad("Enter the team member's full name");
    if (!isEmail(email)) return bad("Enter a valid email address");
    if (!["Admin", "Manager", "Staff"].includes(m.role)) return bad("Choose a role");
    if (staff.some((x) => x.email === email)) { showToast("That email is already on the team"); return false; }
    setStaff((l) => [...l, { name, email, role: m.role, active: true }]); log("Added team member " + email); showToast("Team member added"); return true;
  };
  // There must always be an active Admin, or nobody could manage the team any more.
  const lastAdmin = (m) => m.role === "Admin" && m.active && staff.filter((x) => x.role === "Admin" && x.active).length <= 1;
  const setRole = (i, role) => {
    const m = staff[i];
    if (!m || m.role === role) return false;
    if (role !== "Admin" && lastAdmin(m)) return bad("There must always be one active Admin. Make someone else an Admin first.");
    setStaff((l) => l.map((x, k) => (k === i ? { ...x, role } : x)));
    if (m.email === adm?.email) setAdm({ ...adm, role }); // the signed-in person's access changes straight away
    log(`Role of ${m.email}: ${role}`); showToast("Role updated");
    return true;
  };
  const toggleStaff = (i) => {
    const m = staff[i];
    if (m.active && m.email === adm?.email) return bad("You cannot turn off your own account while you are signed in.");
    if (m.active && lastAdmin(m)) return bad("There must always be one active Admin. Make someone else an Admin first.");
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
    requestCancel, cancelOwnOrder, answerCancel, recordCancelRefund, dismissRefundCheck, restockReturn, updateOrderPayment, requestReturn, answerReturn, policies, savePolicies,
    getProduct, nextProductId, ask, myNotifs, readNotif, readOrderNotifs, readAllNotifs, changePassword, messages, addMessage, setMessageRead, deleteMessage, subscribers, addSubscriber, removeSubscriber,
    showToast, hideToast, setTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
