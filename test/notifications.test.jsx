import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider, useStore } from "../src/store";
import App from "../src/App";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};

const iso = (d = 0) => new Date(Date.now() - d * 864e5).toISOString();
const mk = (id, status, over = {}) => ({
  id, email: "jane@x.rw", date: iso(1), items: [{ id: 0, q: 1, p: 93000 }], sub: 93000, disc: 0, coupon: null, fee: 2000, total: 95000,
  pay: "MTN Mobile Money", name: "Jane Doe", phone: "0788123456", cEmail: "jane@x.rw", area: "Inside Kigali", district: "G", street: "KG 11 Ave", status, payStatus: "Pending", ...over,
});
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
const asAdmin = () => localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role: "Admin" }));
const asJane = () => localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
const note = (id, kind, title, over = {}) => ({ id, email: "jane@x.rw", orderId: "DS-1", kind, title, text: "Details here.", date: iso(0), read: false, ...over });
// another browser tab changing a saved value
const otherTab = (key, value) => act(() => { window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(value), storageArea: window.localStorage })); });
const bell = () => screen.getByRole("button", { name: /^Notifications/ });

describe("customers are told about their orders", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); localStorage.setItem("duchi-all", JSON.stringify([mk("DS-1", "Processing")])); });

  it("each change an admin makes creates a note for that customer, only once", () => {
    go("/admin/orders/DS-1");
    const status = () => screen.getByLabelText("Order status");
    fireEvent.change(status(), { target: { value: "Dispatched" } });
    fireEvent.change(status(), { target: { value: "Delivered" } });
    fireEvent.change(screen.getByLabelText("Payment status"), { target: { value: "Paid" } });
    fireEvent.change(screen.getByLabelText("Payment status"), { target: { value: "Paid" } });   // the same status again says nothing new
    const n = db("duchi-notifs");
    expect(n.map((x) => x.title)).toEqual(["Payment received for order DS-1", "Order DS-1 has been delivered", "Order DS-1 is on its way"]);
    expect(n.every((x) => x.email === "jane@x.rw" && x.orderId === "DS-1" && x.read === false)).toBe(true);
    fireEvent.change(screen.getByLabelText("Payment status"), { target: { value: "Pending" } });
    expect(db("duchi-notifs").length).toBe(3);                                                   // going back to Pending is not news
  });

  it("cancelling asks in a toast, returns the stock, and tells the customer", () => {
    go("/admin/orders");
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "Cancelled" } });
    expect(screen.getByRole("alertdialog").textContent).toContain("Cancel order DS-1?");
    expect(db("duchi-notifs")).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));
    expect(db("duchi-all")[0].status).toBe("Cancelled");
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "cancelled", title: "Order DS-1 was cancelled", email: "jane@x.rw" });
    expect(db("duchi-products")[0].stock).toBe(13);
  });
});

describe("the customer's bell", () => {
  beforeEach(() => {
    localStorage.clear(); asJane();
    localStorage.setItem("duchi-all", JSON.stringify([mk("DS-1", "Dispatched")]));
    localStorage.setItem("duchi-notifs", JSON.stringify([
      note("n1", "dispatched", "Order DS-1 is on its way"), note("n2", "paid", "Payment received for order DS-1", { read: true, date: iso(2) }),
      { ...note("n3", "delivered", "Order DS-9 has been delivered"), email: "someone@else.rw" },
    ]));
  });

  it("counts what is new, lists it, opens the order and marks it as read", () => {
    go("/account");
    expect(bell().textContent).toBe("1");                                      // only this customer's unread note
    fireEvent.click(bell());
    const menu = screen.getByRole("menu", { name: "Notifications" });
    expect(within(menu).getByText("Order DS-1 is on its way")).toBeTruthy();
    expect(within(menu).getByText("Payment received for order DS-1")).toBeTruthy();
    expect(within(menu).queryByText("Order DS-9 has been delivered")).toBeNull();
    fireEvent.click(within(menu).getByText("Order DS-1 is on its way"));
    expect(screen.getByRole("heading", { name: "Order DS-1" })).toBeTruthy();   // it opens the order
    expect(db("duchi-notifs").find((x) => x.id === "n1").read).toBe(true);
    expect(bell().textContent).toBe("");
  });

  it("mark all as read, and an empty bell explains itself", () => {
    localStorage.setItem("duchi-notifs", JSON.stringify([note("n1", "dispatched", "Order DS-1 is on its way"), note("n2", "paid", "Payment received for order DS-1")]));
    go("/account");
    expect(bell().textContent).toBe("2");
    fireEvent.click(bell());
    fireEvent.click(screen.getByText("Mark all as read"));
    expect(db("duchi-notifs").every((x) => x.read)).toBe(true);
    localStorage.setItem("duchi-notifs", JSON.stringify([]));
    go("/account");
    fireEvent.click(bell());
    expect(screen.getByText(/We will tell you here when your order is dispatched, delivered or cancelled/)).toBeTruthy();
  });

  it("is in the shop header for signed in customers only", () => {
    go("/");
    expect(bell()).toBeTruthy();
    localStorage.removeItem("duchi-user");
    go("/");
    expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull();
  });

  it("follows changes the admin makes in another tab: the order, the bell and a toast", async () => {
    go("/account/orders/DS-1");
    expect(screen.getByText("Dispatched")).toBeTruthy();
    expect(bell().textContent).toBe("1");
    otherTab("duchi-all", [mk("DS-1", "Delivered")]);
    otherTab("duchi-notifs", [note("n4", "delivered", "Order DS-1 has been delivered"), note("n1", "dispatched", "Order DS-1 is on its way")]);
    await waitFor(() => expect(bell().textContent).toBe("2"));
    expect(document.querySelector(".steps .d:last-child")?.textContent).toBe("Delivered");   // the progress bar moved on
    expect(document.querySelector(".toast").textContent).toContain("Order DS-1 has been delivered");
    expect(within(document.querySelector(".toast")).getByText("View")).toBeTruthy();
  });

  it("does not announce notes that were already there when the page opened", () => {
    go("/account");
    expect(document.querySelector(".toast.show")).toBeNull();
  });
});

describe("mobile money needs the number paid from", () => {
  beforeEach(() => {
    localStorage.clear(); asJane();
    localStorage.setItem("duchi-cart", JSON.stringify([{ id: 0, q: 1 }]));
  });
  it("blocks the order until it is filled in correctly, then saves it tidy", async () => {
    const { container } = go("/checkout");
    const f = container.querySelector("form");
    const type = (label, v) => fireEvent.change(within(f).getByLabelText(new RegExp("^" + label)), { target: { value: v } });
    type("District", "Gasabo"); type("Delivery address", "KG 11 Ave, near the church");
    expect(within(f).getByText("Number you paid from")).toBeTruthy();
    expect(screen.queryByText(/Number you paid from \(optional\)/)).toBeNull();                        // no longer optional
    fireEvent.submit(f);
    expect(screen.getByText("Enter the phone number you paid from, so we can match your payment.")).toBeTruthy();
    expect(db("duchi-all") ?? []).toEqual([]);
    type("Number you paid from", "12345");
    fireEvent.submit(f);
    expect(screen.getByText(/That phone number does not look right/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Airtel Money"));                                           // Airtel needs it too
    fireEvent.submit(f);
    expect(screen.getByText(/That phone number does not look right/)).toBeTruthy();
    type("Number you paid from", "+250 788 000 111");
    fireEvent.submit(f);
    await waitFor(() => expect(db("duchi-all")?.length).toBe(1));
    expect(db("duchi-all")[0]).toMatchObject({ pay: "Airtel Money", payPhone: "0788000111" });
  });
  it("is not asked for bank transfer, and a number typed earlier is not kept", async () => {
    const { container } = go("/checkout");
    const f = container.querySelector("form");
    fireEvent.change(within(f).getByLabelText(/^District/), { target: { value: "Gasabo" } });
    fireEvent.change(within(f).getByLabelText(/^Delivery address/), { target: { value: "KG 11 Ave, near the church" } });
    fireEvent.change(within(f).getByLabelText(/^Number you paid from/), { target: { value: "0788000111" } });
    fireEvent.click(screen.getByLabelText("Bank transfer"));
    expect(screen.queryByText("Number you paid from")).toBeNull();
    fireEvent.submit(f);
    await waitFor(() => expect(db("duchi-all")?.length).toBe(1));
    expect(db("duchi-all")[0].payPhone).toBe("");
  });
});

describe("questions in the toast", () => {
  beforeEach(() => { localStorage.clear(); asJane(); });
  it("Escape and 'No' both leave things as they were; the question never uses a browser pop-up", () => {
    let popups = 0;
    window.confirm = () => { popups++; return true; };
    localStorage.setItem("duchi-addrs", JSON.stringify({ "jane@x.rw": [{ label: "Home", name: "Jane Doe", phone: "0788123456", zone: 0, district: "Gasabo", street: "KG 1" }] }));
    go("/account/addresses");
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByRole("alertdialog").textContent).toContain('Delete the address "Home"?');
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector(".toast.show")).toBeNull();
    expect(db("duchi-addrs")["jane@x.rw"].length).toBe(1);
    fireEvent.click(screen.getByText("Delete"));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(db("duchi-addrs")["jane@x.rw"].length).toBe(0);
    expect(popups).toBe(0);
  });
});
