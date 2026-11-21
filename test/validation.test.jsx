import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider, useStore } from "../src/store";
import App from "../src/App";
import { clean, isEmail, isPhone, normPhone, isName, intIn, isLuhn, cardExpiryOk } from "../src/lib";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};
window.confirm = () => true;

const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
// A label also holds its error message while there is one, so a plain text label is matched by how it starts.
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byLabel = (root, l) => within(root).getByLabelText(typeof l === "string" ? new RegExp("^" + esc(l)) : l);
const empty = (k) => { const v = db(k); return v == null || (Array.isArray(v) ? !v.length : !Object.keys(v).length); };
const type = (root, re, v) => fireEvent.change(byLabel(root, re), { target: { value: v } });
const asAdmin = (role = "Admin", email = "admin@duchistore.rw") => localStorage.setItem("duchi-adm", JSON.stringify({ email, name: role, role }));

// A tiny component that hands the store to the test, so store rules can be called directly.
let S;
const Probe = () => { S = useStore(); return null; };
const boot = () => { cleanup(); render(<MemoryRouter><StoreProvider><Probe /></StoreProvider></MemoryRouter>); };
const call = (fn) => { let r; act(() => { r = fn(); }); return r; };
const toastText = () => document.querySelector(".toast")?.textContent || "";
const storeToast = () => S.toast?.msg || "";

describe("shared checks", () => {
  it("emails, phones, names, numbers and cards", () => {
    expect(isEmail("a@b")).toBe(false); expect(isEmail(" jane@x.rw ")).toBe(true); expect(isEmail("jane @x.rw")).toBe(false);
    expect(isPhone("0788 123 456")).toBe(true); expect(isPhone("+250 788 123 456")).toBe(true); expect(isPhone("0711111111")).toBe(false); expect(isPhone("123")).toBe(false); expect(isPhone("+1 415 555 2671")).toBe(true);
    expect(normPhone("+250788123456")).toBe("0788123456");
    expect(isName("A")).toBe(false); expect(isName("  ")).toBe(false); expect(isName("12")).toBe(false); expect(isName("Eric N")).toBe(true);
    expect(clean("  Jane   Doe ")).toBe("Jane Doe");
    expect(intIn("2500")).toBe(2500); expect(intIn("12.5")).toBe(null); expect(intIn("-1")).toBe(null); expect(intIn("")).toBe(null); expect(intIn("101", 1, 100)).toBe(null);
    expect(isLuhn("4242 4242 4242 4242")).toBe(true); expect(isLuhn("4242 4242 4242 4243")).toBe(false);
    expect(cardExpiryOk("12/99")).toBe(true); expect(cardExpiryOk("01/20")).toBe(false); expect(cardExpiryOk("13/30")).toBe(false);
  });
});

describe("customer sign in and create account", () => {
  beforeEach(() => localStorage.clear());
  const form = (c) => c.querySelector("form");

  it("explains each problem and creates the account only when everything is right", async () => {
    const { container } = go("/login");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.submit(form(container));
    expect(screen.getByText("Enter your full name.")).toBeTruthy();
    expect(screen.getByText(/Enter a valid email address/)).toBeTruthy();
    expect(screen.getByText(/Enter a valid phone number/)).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(document.querySelector('[aria-invalid="true"]')).toBeTruthy();
    type(form(container), "Full name", "Jane Doe"); type(form(container), "Email", "jane@x.rw"); type(form(container), "Phone number", "12345");
    type(form(container), /^Password/, "short"); type(form(container), "Confirm password", "short");
    fireEvent.submit(form(container));
    expect(screen.getByText(/Enter a valid phone number/)).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    type(form(container), "Phone number", "0788 123 456"); type(form(container), /^Password/, "secret123"); type(form(container), "Confirm password", "secret124");
    fireEvent.submit(form(container));
    expect(screen.getByText("The two passwords do not match.")).toBeTruthy();
    type(form(container), "Confirm password", "secret123");
    fireEvent.submit(form(container));
    await waitFor(() => expect(db("duchi-user")?.email).toBe("jane@x.rw"));
    const rec = db("duchi-users")["jane@x.rw"];
    expect(rec.phone).toBe("0788123456");
    expect(rec.pwh).toBeTruthy(); expect(JSON.stringify(db("duchi-user"))).not.toContain("pwh"); // the session never holds the hash
    expect(JSON.stringify(rec)).not.toContain("secret123");                                       // and the password is never stored as text
  });

  it("checks the password on sign in, rejects unknown emails and duplicates, and upgrades older accounts", async () => {
    boot();
    let r = await act(async () => S.signIn({ email: "jane@x.rw", name: "Jane Doe", phone: "0788123456", pw: "secret123", register: true }));
    expect(r.ok).toBe(true);
    act(() => S.signOut());
    r = await act(async () => S.signIn({ email: "jane@x.rw", pw: "wrongpass1" }));
    expect(r).toMatchObject({ ok: false }); expect(r.error).toContain("incorrect");
    r = await act(async () => S.signIn({ email: "nobody@x.rw", pw: "secret123" }));
    expect(r.ok).toBe(false);                                          // no account is created by signing in
    expect(db("duchi-users")["nobody@x.rw"]).toBeUndefined();
    r = await act(async () => S.signIn({ email: "jane@x.rw", name: "Other", phone: "0788123456", pw: "secret123", register: true }));
    expect(r.error).toContain("already exists");
    r = await act(async () => S.signIn({ email: "jane@x.rw", pw: "secret123" }));
    expect(r.ok).toBe(true);
    // an account saved before passwords existed: the first sign in sets its password, the next one must match
    localStorage.setItem("duchi-users", JSON.stringify({ ...db("duchi-users"), "old@x.rw": { name: "Old Customer", email: "old@x.rw", phone: "0788000001" } }));
    boot();
    r = await act(async () => S.signIn({ email: "old@x.rw", pw: "firstpass1" }));
    expect(r.ok).toBe(true); expect(db("duchi-users")["old@x.rw"].pwh).toBeTruthy();
    act(() => S.signOut());
    r = await act(async () => S.signIn({ email: "old@x.rw", pw: "otherpass1" }));
    expect(r.ok).toBe(false);
  });
});

describe("contact form", () => {
  beforeEach(() => localStorage.clear());
  it("needs a real name, email, a valid optional phone and a message of at least 10 characters", () => {
    const { container } = go("/contact");
    const f = container.querySelector("form");
    fireEvent.submit(f);
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Please write at least 10 characters so we can help you.")).toBeTruthy();
    type(f, "Name", "   "); type(f, "Email", "a@b"); type(f, "Phone (optional)", "abc"); type(f, "Message", "too short");
    fireEvent.submit(f);
    expect(screen.getByText("Enter your name.")).toBeTruthy();            // spaces alone do not count
    expect(screen.getByText(/Enter a valid email/)).toBeTruthy();
    expect(screen.getByText(/Enter a valid phone number/)).toBeTruthy();
    expect(empty("duchi-messages")).toBe(true);
    type(f, "Name", "Alice"); type(f, "Email", "alice@x.rw"); type(f, "Phone (optional)", ""); type(f, "Message", "Do you deliver to Musanze?");
    fireEvent.submit(f);
    expect(screen.getByText("Message sent")).toBeTruthy();
    expect(db("duchi-messages").length).toBe(1);
  });
  it("stops a flood of messages from one email", () => {
    boot();
    const send = (t) => call(() => S.addMessage({ name: "Bob", email: "bob@x.rw", phone: "", text: t }));
    expect(send("first message here")).toBe(true); expect(send("second message here")).toBe(true); expect(send("third message here")).toBe(true);
    expect(send("fourth message here")).toBe(false);
    expect(db("duchi-messages").length).toBe(3);
  });
});

describe("orders cannot be placed with wrong data", () => {
  const order = (over = {}) => ({ name: "Jane Doe", phone: "0788 123 456", cEmail: "jane@x.rw", district: "Gasabo", street: "KG 11 Ave", zi: 0, pay: "Bank transfer", coupon: null, payRef: "", payPhone: "", card: null, ...over });
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
    localStorage.setItem("duchi-cart", JSON.stringify([{ id: 0, q: 2 }]));
  });
  it("checks the details, the stock and the coupon in the store", () => {
    boot();
    expect(call(() => S.placeOrder(order({ phone: "12" })))).toBe(null);
    expect(call(() => S.placeOrder(order({ cEmail: "nope" })))).toBe(null);
    expect(call(() => S.placeOrder(order({ street: "x" })))).toBe(null);
    expect(call(() => S.placeOrder(order({ zi: 9 })))).toBe(null);
    expect(call(() => S.placeOrder(order({ pay: "Cash" })))).toBe(null);
    expect(call(() => S.placeOrder(order({ coupon: "NOPE" })))).toBe(null);
    expect(call(() => S.placeOrder(order({ payPhone: "abc", pay: "MTN Mobile Money" })))).toBe(null);
    expect(empty("duchi-all")).toBe(true);
    const id = call(() => S.placeOrder(order({ coupon: "welcome10" })));
    expect(id).toMatch(/^DS-\d+$/);
    const o = db("duchi-all")[0];
    expect(o.phone).toBe("0788123456"); expect(o.disc).toBe(19000); expect(o.total).toBe(190000 - 19000 + 2000); // the store works out the discount itself
    expect(db("duchi-products")[0].stock).toBe(10);
  });
  it("will not sell more than is in stock", () => {
    localStorage.setItem("duchi-cart", JSON.stringify([{ id: 7, q: 5 }])); // only 4 of the Legacy Date are in stock
    boot();
    expect(call(() => S.placeOrder(order()))).toBe(null);
    expect(storeToast()).toContain("Only 4");
    expect(empty("duchi-all")).toBe(true); expect(db("duchi-products")[0].stock).toBe(12);
  });
  it("checkout form shows a message under each wrong field", async () => {
    const { container } = go("/checkout");
    const f = container.querySelector("form");
    fireEvent.click(screen.getByLabelText("Bank transfer"));
    type(f, "Full name", ""); type(f, "Phone number", "");   // the form starts with the signed-in customer's details
    fireEvent.submit(f);
    expect(screen.getByText("Enter the full name for delivery.")).toBeTruthy();
    expect(screen.getByText(/Enter a valid phone number/)).toBeTruthy();
    expect(screen.getByText("Enter the district, for example Gasabo.")).toBeTruthy();
    expect(screen.getByText("Enter the sector, street and a landmark.")).toBeTruthy();
    expect(empty("duchi-all")).toBe(true);
  });
  it("card form checks the number, the expiry and the code", async () => {
    const { container } = go("/checkout");
    const f = container.querySelector("form");
    fireEvent.click(screen.getByLabelText("Card"));
    type(f, "Full name", "Jane Doe"); type(f, "Phone number", "0788123456"); type(f, "Email", "jane@x.rw"); type(f, "District", "Gasabo"); type(f, "Delivery address", "KG 11 Ave");
    const submit = async () => { fireEvent.submit(f); await waitFor(() => expect(toastText().length).toBeGreaterThan(0)); };
    type(f, "Card number", "4242 4242 4242 4243"); type(f, "Expiry (MM/YY)", "12/99"); type(f, "Security code", "123");
    await submit(); expect(toastText()).toContain("valid card number");
    type(f, "Card number", "4242 4242 4242 4242"); type(f, "Expiry (MM/YY)", "01/20");
    await submit(); expect(toastText()).toMatch(/expir/);
    expect(empty("duchi-all")).toBe(true);
    type(f, "Expiry (MM/YY)", "12/99"); type(f, "Security code", "12");
    await submit(); expect(toastText()).toContain("security code");
    type(f, "Security code", "123");
    fireEvent.submit(f);
    await waitFor(() => expect(db("duchi-all")?.length).toBe(1));
    expect(db("duchi-all")[0].card.last4).toBe("4242");
  });
});

describe("admin rules", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); boot(); });
  it("coupons: code format, percent from 1 to 100, whole numbers", () => {
    expect(call(() => S.addCoupon({ code: "AB", type: "pct", val: 10 }))).toBe(false);
    expect(call(() => S.addCoupon({ code: "BAD CODE", type: "pct", val: 10 }))).toBe(false);
    expect(call(() => S.addCoupon({ code: "BIG", type: "pct", val: 150 }))).toBe(false);
    expect(call(() => S.addCoupon({ code: "ZERO", type: "pct", val: 0 }))).toBe(false);
    expect(call(() => S.addCoupon({ code: "HALF", type: "fix", val: 12.5 }))).toBe(false);
    expect(call(() => S.addCoupon({ code: "WELCOME10", type: "pct", val: 10 }))).toBe(false); // already exists
    expect(call(() => S.addCoupon({ code: " save5k ", type: "fix", val: "5000" }))).toBe(true);
    expect(db("duchi-coupons")[0]).toEqual({ code: "SAVE5K", type: "fix", val: 5000, active: true });
  });
  it("shipping: every zone needs its own name and a whole fee", () => {
    expect(call(() => S.saveZones([]))).toBe(false);
    expect(call(() => S.saveZones([{ name: " ", fee: 1000 }]))).toBe(false);
    expect(call(() => S.saveZones([{ name: "Kigali", fee: 1000 }, { name: "kigali ", fee: 2000 }]))).toBe(false);
    expect(call(() => S.saveZones([{ name: "Kigali", fee: "-5" }]))).toBe(false);
    expect(call(() => S.saveZones([{ name: "Kigali", fee: "2.5" }]))).toBe(false);
    expect(call(() => S.saveZones([{ name: "  Inside   Kigali ", fee: "2500" }, { name: "Elsewhere", fee: 3000 }]))).toBe(true);
    expect(db("duchi-zones")).toEqual([{ name: "Inside Kigali", fee: 2500 }, { name: "Elsewhere", fee: 3000 }]);
  });
  it("payments: digits for the merchant code and a real dial code", () => {
    const ok = { mtn: { code: "123456", tpl: "*182*8*1*{code}#" }, airtel: { code: "654321", tpl: "*500#" } };
    expect(call(() => S.savePayCfg({ ...ok, mtn: { code: "12ab", tpl: ok.mtn.tpl } }))).toBe(false);
    expect(call(() => S.savePayCfg({ ...ok, mtn: { code: "123456", tpl: "182*8*1#" } }))).toBe(false);
    expect(call(() => S.savePayCfg({ ...ok, airtel: { code: "654321", tpl: "*500" } }))).toBe(false);
    expect(call(() => S.savePayCfg({ ...ok, airtel: { code: "654321", tpl: "*500#; drop" } }))).toBe(false);
    expect(call(() => S.savePayCfg(ok))).toBe(true);
  });
  it("team: keeps one active Admin and never switches off the person who is signed in", () => {
    const i = (e) => S.staff.findIndex((x) => x.email === e);
    expect(call(() => S.addStaff({ name: "E", email: "e@x.rw", role: "Staff" }))).toBe(false);
    expect(call(() => S.addStaff({ name: "Eric N", email: "bad", role: "Staff" }))).toBe(false);
    expect(call(() => S.addStaff({ name: "Eric N", email: " ERIC@x.rw ", role: "Boss" }))).toBe(false);
    expect(call(() => S.addStaff({ name: "Eric  N", email: " ERIC@x.rw ", role: "Staff" }))).toBe(true);
    expect(db("duchi-staff").at(-1)).toMatchObject({ name: "Eric N", email: "eric@x.rw", active: true });
    expect(call(() => S.setRole(i("admin@duchistore.rw"), "Staff"))).toBe(false);     // the only Admin
    expect(call(() => S.toggleStaff(i("admin@duchistore.rw")))).toBe(false);          // yourself
    expect(call(() => S.setRole(i("eric@x.rw"), "Admin"))).toBe(true);                // a second Admin ...
    expect(call(() => S.setRole(i("admin@duchistore.rw"), "Manager"))).toBe(true);    // ... lets the first one step down
    expect(JSON.parse(localStorage.getItem("duchi-adm")).role).toBe("Manager");        // and their access follows straight away
  });
  it("products: stock and price must be whole numbers", () => {
    expect(call(() => S.setStock(0, 2.5))).toBe(false); expect(call(() => S.setStock(0, -1))).toBe(false); expect(call(() => S.setStock(0, NaN))).toBe(false);
    expect(call(() => S.setStock(0, 7))).toBe(true);
    const base = { id: 8, n: "Valid", s: "Blue", c: "Steel", p: 1000, stock: 1, tag: "", active: true, im: ["x"], desc: "", highlights: [], box: "", spec: {} };
    expect(call(() => S.saveProduct({ ...base, p: 99.5 }))).toBe(false);
    expect(call(() => S.saveProduct({ ...base, stock: 1.5 }))).toBe(false);
    expect(call(() => S.saveProduct({ ...base, n: "  " }))).toBe(false);
    expect(call(() => S.saveProduct(base))).toBe(true);
  });
  it("categories need at least two characters", () => {
    expect(call(() => S.addCategory(" a "))).toBe(false);
    expect(call(() => S.addCategory("  Smart   Watches "))).toBe(true);
    expect(db("duchi-cats").at(-1).name).toBe("Smart Watches");
  });
  it("cancelling an order asks first", () => {
    localStorage.setItem("duchi-all", JSON.stringify([{ id: "DS-1", email: "a@x.rw", date: new Date().toISOString(), items: [{ id: 0, q: 1, p: 1000 }], sub: 1000, disc: 0, fee: 0, total: 1000, pay: "Card", name: "A", phone: "0788000000", status: "Processing", payStatus: "Paid" }]));
    let asked = 0;
    window.confirm = () => { asked++; return false; };
    go("/admin/orders");
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "Cancelled" } });
    expect(asked).toBe(1); expect(db("duchi-all")[0].status).toBe("Processing");
    window.confirm = () => true;
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "Cancelled" } });
    expect(db("duchi-all")[0].status).toBe("Cancelled");
  });
});

describe("customer addresses and profile", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
  });
  it("address form shows what to fix, then saves clean values", () => {
    const { container } = go("/account/addresses");
    fireEvent.click(screen.getByText("Add address"));
    const f = container.querySelector("form");
    type(f, "Label", "  "); type(f, "Phone", "999"); type(f, "District", ""); type(f, "Street and landmark", "");
    fireEvent.submit(f);
    expect(screen.getByText("Give the address a short label, like Home.")).toBeTruthy();
    expect(screen.getByText(/Enter a valid phone number/)).toBeTruthy();
    expect(screen.getByText("Enter the district.")).toBeTruthy();
    expect(empty("duchi-addrs")).toBe(true);
    type(f, "Label", " Home "); type(f, "Phone", "+250 788 123 456"); type(f, "District", "Kicukiro"); type(f, "Street and landmark", "KK 5 Rd, near the church");
    fireEvent.submit(f);
    expect(db("duchi-addrs")["jane@x.rw"][0]).toMatchObject({ label: "Home", phone: "0788123456", district: "Kicukiro" });
  });
  it("profile: name and phone are checked, and the password can be changed", async () => {
    boot();
    await act(async () => S.signIn({ email: "jane@x.rw", name: "Jane Doe", phone: "0788123456", pw: "secret123", register: true }).catch(() => {}));
    cleanup();
    const { container } = go("/account/profile");
    const [pf, pwf] = container.querySelectorAll("form");
    type(pf, "Full name", " "); type(pf, "Phone", "abc");
    fireEvent.submit(pf);
    expect(screen.getByText("Enter your full name.")).toBeTruthy();
    expect(screen.getByText(/Enter a valid phone number/)).toBeTruthy();
    type(pf, "Full name", "Jane D"); type(pf, "Phone", "");
    fireEvent.submit(pf);
    expect(db("duchi-user").name).toBe("Jane D");
    fireEvent.submit(pwf);
    expect(screen.getByText("Enter your current password.")).toBeTruthy();
    type(pwf, "Current password", "secret123"); type(pwf, "New password", "newpass12"); type(pwf, "Confirm new password", "different1");
    fireEvent.submit(pwf);
    expect(screen.getByText("The two passwords do not match.")).toBeTruthy();
  });
});
