import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider, useStore } from "../src/store";
import App from "../src/App";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};

const DAY = 864e5, iso = (d = 0) => new Date(Date.now() - d * DAY).toISOString();
const mk = (id, status, over = {}) => ({
  id, email: "jane@x.rw", date: iso(3), items: [{ id: 0, q: 2, p: 46500, n: "Axis Day-Date", c: "Steel" }], sub: 93000, disc: 0, coupon: null, fee: 2000, total: 95000,
  pay: "MTN Mobile Money", name: "Jane Doe", phone: "0788123456", cEmail: "jane@x.rw", area: "Inside Kigali", district: "Gasabo", street: "KG 11 Ave", status, payStatus: "Pending", payPhone: "0788123456", ...over,
});
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
const asJane = () => localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
const asAdmin = () => localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role: "Admin" }));
const seed = (orders) => localStorage.setItem("duchi-all", JSON.stringify(orders));
const setPolicies = (over) => localStorage.setItem("duchi-policies", JSON.stringify({ delivery: [], returns: [], warranty: [], terms: [], privacy: [], tracking: ["x"], returnDays: 14, ...over }));
const stock = () => db("duchi-products").find((p) => p.id === 0).stock;
const byLabel = (root, l) => within(root).getByLabelText(typeof l === "string" ? new RegExp("^" + l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : l);
const type = (root, l, v) => fireEvent.change(byLabel(root, l), { target: { value: v } });
let S;
const Probe = () => { S = useStore(); return null; };
const boot = () => { cleanup(); render(<MemoryRouter><StoreProvider><Probe /></StoreProvider></MemoryRouter>); };
const call = (fn) => { let r; act(() => { r = fn(); }); return r; };

describe("a customer cancels an order that has no confirmed payment", () => {
  beforeEach(() => { localStorage.clear(); asJane(); });

  it("cancels at once after a confirmation in the toast; the watches go back into stock", () => {
    seed([mk("DS-1", "Processing", { pay: "Bank transfer", payPhone: "" })]);
    go("/account/orders/DS-1");
    expect(screen.getByText(/You can cancel this order now, because we have not confirmed a payment yet/)).toBeTruthy();
    expect(screen.queryByText("Request cancellation")).toBeNull();
    fireEvent.click(screen.getByText("Cancel order"));
    expect(screen.getByRole("alertdialog").textContent).toContain("Cancel order DS-1 now?");
    fireEvent.click(screen.getByRole("button", { name: "No, keep it" }));
    expect(db("duchi-all")[0].status).toBe("Processing");
    fireEvent.click(screen.getByText("Cancel order"));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));
    expect(db("duchi-all")[0]).toMatchObject({ status: "Cancelled", cancelledBy: "customer" });
    expect(db("duchi-all")[0].restockedAt).toBeTruthy();
    expect(db("duchi-all")[0].refundCheck).toBeUndefined();                         // bank transfer: nothing was paid yet
    expect(stock()).toBe(14);                                                        // 12 + the 2 in the order
    expect(db("duchi-audit")[0].m).toBe("Order DS-1: Processing to Cancelled");
    expect(db("duchi-audit")[0].w).toBe("jane@x.rw");                                // the log says the customer did it
    expect(db("duchi-notifs") ?? []).toEqual([]);                                    // no bell message for their own action
    expect(screen.getByText(/You cancelled this order on/)).toBeTruthy();
  });

  it("mobile money is flagged for a payment check: the money may already have been sent", () => {
    seed([mk("DS-1", "Processing")]);
    go("/account/orders/DS-1");
    fireEvent.click(screen.getByText("Cancel order"));
    expect(screen.getByRole("alertdialog").textContent).toContain("If you already sent money, we will check our records");
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));
    expect(db("duchi-all")[0]).toMatchObject({ status: "Cancelled", refundCheck: "check" });
    expect(screen.getAllByText(/we will check our records and contact you/).length).toBeGreaterThan(0);   // in the toast and on the page

    asAdmin();
    go("/admin/orders");
    expect(screen.getByText("Check payment")).toBeTruthy();
    expect(screen.getByText("Cancelled by customer")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Needs action/ }).textContent).toBe("Needs action1");
    go("/admin");
    expect(screen.getByText("Orders needing action").closest("a").textContent).toContain("1");
  });

  it("paid, dispatched and other people's orders are not cancelled by the customer", () => {
    seed([mk("DS-1", "Processing", { payStatus: "Paid" }), mk("DS-2", "Dispatched"), mk("DS-3", "Processing", { email: "x@y.rw" })]);
    boot();
    for (const id of ["DS-1", "DS-2", "DS-3"]) expect(call(() => S.cancelOwnOrder(id))).toBe(false);
    expect(db("duchi-all").every((o) => o.status !== "Cancelled")).toBe(true);
    go("/account/orders/DS-1");
    expect(screen.queryByText("Cancel order")).toBeNull();
    expect(screen.getByText("Request cancellation")).toBeTruthy();                   // a paid order still needs the shop to agree
  });

  it("the admin checks the money: nothing received, or record the refund", () => {
    seed([mk("DS-1", "Processing"), mk("DS-2", "Processing")]);
    boot(); call(() => S.cancelOwnOrder("DS-1")); call(() => S.cancelOwnOrder("DS-2"));
    asAdmin();
    go("/admin/orders");
    fireEvent.click(screen.getAllByText("View")[0]);
    let dlg = screen.getByRole("dialog");
    fireEvent.click(within(dlg).getByText("No money was received"));
    expect(db("duchi-all").find((o) => o.refundCheck === "none")).toBeTruthy();
    cleanup(); go("/admin/orders");
    expect(screen.getAllByText("Check payment").length).toBe(1);                      // only the other one is still waiting
    fireEvent.click(within(screen.getByText("Check payment").closest("tr")).getByText("View"));
    dlg = screen.getByRole("dialog");
    const f = within(dlg).getByText("Record refund").closest("form");
    type(f, "Refund (RWF)", "999999");
    fireEvent.submit(f);
    expect(db("duchi-all").some((o) => o.refund)).toBe(false);                       // more than the total is refused
    type(f, "Refund (RWF)", "95000"); type(f, "How it was sent", "MTN MoMo to 0788 123 456");
    fireEvent.submit(f);
    const o = db("duchi-all").find((x) => x.refund);
    expect(o).toMatchObject({ refund: { amount: 95000, method: "MTN MoMo to 0788 123 456" }, refundCheck: "refunded" });
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "refunded", title: `Refund recorded for order ${o.id}` });
    expect(db("duchi-all").every((x) => x.refundCheck !== "check")).toBe(true);
    go("/admin");
    expect(screen.getByText(/Refunded in this period:/).textContent).toContain("RWF 95,000");
    go(`/receipt/${o.id}`);
    expect(screen.getByText("−RWF 95,000")).toBeTruthy();
    asJane(); localStorage.removeItem("duchi-adm");
    go(`/account/orders/${o.id}`);
    expect(screen.getAllByText(/We recorded a refund of RWF 95,000/).length).toBeGreaterThan(0);
  });

  it("a paid order cancelled by the admin shows as a refund due", () => {
    seed([mk("DS-1", "Processing", { payStatus: "Paid" })]);
    asAdmin(); boot();
    call(() => S.setOrderStatus("DS-1", "Cancelled"));
    go("/admin/orders");
    expect(screen.getByText("Refund due")).toBeTruthy();
    fireEvent.click(screen.getByText("View"));
    fireEvent.click(within(screen.getByRole("dialog")).getByText("No refund needed"));
    expect(db("duchi-all")[0].refundCheck).toBe("none");
    expect(screen.queryByText("Refund due")).toBeNull();
  });
});

describe("the admin decides what happens to a returned watch", () => {
  beforeEach(() => {
    localStorage.clear(); asAdmin(); setPolicies({});
    seed([mk("DS-1", "Delivered", { payStatus: "Paid", deliveredAt: iso(2), returnReq: { date: iso(1), reason: "The watch has a fault", note: "", status: "approved", answer: "Send it to our shop." } })]);
  });

  it("a restock decision is waiting, and 'Put back in stock' adds the quantity once", () => {
    go("/admin/orders");
    expect(screen.getByText("Restock decision")).toBeTruthy();
    fireEvent.click(screen.getByText("View"));
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByText(/Needs your attention: Restock decision/)).toBeTruthy();
    expect(within(dlg).getByText(/In stock now:/).textContent).toContain("12");
    fireEvent.click(within(dlg).getByText("Put back in stock"));
    expect(screen.getByRole("alertdialog").textContent).toContain("Add 2 × Axis Day-Date back into the stock?");
    expect(stock()).toBe(12);                                                         // nothing yet
    fireEvent.click(screen.getByRole("button", { name: "Yes, add to stock" }));
    expect(stock()).toBe(14);
    expect(db("duchi-all")[0].returnReq).toMatchObject({ restock: "yes" });
    expect(within(screen.getByRole("dialog")).getByText(/were put back in stock on/)).toBeTruthy();
    expect(screen.queryByText("Restock decision")).toBeNull();
    boot();
    expect(call(() => S.restockReturn("DS-1", true))).toBe(false);                    // the decision cannot be made twice
    expect(stock()).toBe(14);
  });

  it("'Do not restock' keeps a damaged watch out of the stock", () => {
    go("/admin/orders/DS-1");
    fireEvent.click(screen.getByText("Do not restock"));
    fireEvent.click(screen.getByRole("button", { name: "Yes, do not restock" }));
    expect(stock()).toBe(12);
    expect(db("duchi-all")[0].returnReq.restock).toBe("no");
    expect(screen.getByText(/were not added back to the stock/)).toBeTruthy();
    expect(db("duchi-audit")[0].m).toContain("not put back in stock");
  });

  it("is only possible after the return was approved", () => {
    seed([mk("DS-1", "Delivered", { returnReq: { date: iso(1), reason: "The watch has a fault", note: "", status: "pending" } }), mk("DS-2", "Delivered")]);
    boot();
    expect(call(() => S.restockReturn("DS-1", true))).toBe(false);
    expect(call(() => S.restockReturn("DS-2", true))).toBe(false);
    expect(stock()).toBe(12);
  });
});

describe("the order details side panel on the Orders list", () => {
  beforeEach(() => {
    localStorage.clear(); asAdmin();
    seed([mk("DS-1", "Processing", { payStatus: "Paid", cancelReq: { date: iso(0), reason: "I ordered the wrong watch", status: "pending" } }), mk("DS-2", "Delivered", { payStatus: "Paid" })]);
    localStorage.setItem("duchi-audit", JSON.stringify([{ t: iso(0), w: "jane@x.rw", m: "Cancellation requested for order DS-1" }, { t: iso(3), w: "jane@x.rw", m: "New order DS-1" }]));
  });

  it("the View button, the order number and the row all open it; it shows the reason and lets you answer", () => {
    go("/admin/orders");
    expect(screen.getAllByRole("button", { name: /^View order/ }).length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "View order DS-1" }));
    let dlg = screen.getByRole("dialog", { name: "Order DS-1" });
    expect(within(dlg).getByText("I ordered the wrong watch")).toBeTruthy();                // the reason, right there
    expect(within(dlg).getByText(/Needs your attention: Cancel request/)).toBeTruthy();
    expect(within(dlg).getByText("Approve and cancel order")).toBeTruthy();
    expect(within(dlg).getByText("Decline")).toBeTruthy();
    expect(within(dlg).getByText("Cancellation requested for order DS-1")).toBeTruthy();    // activity of this order
    expect(within(dlg).getByText("Open full page").getAttribute("href")).toBe("/admin/orders/DS-1");
    expect(within(dlg).getByText(/Adjust stock/).getAttribute("href")).toBe("/admin/products?q=Axis%20Day-Date");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByText("DS-2"));                                              // the order number opens it, it does not leave the list
    expect(screen.getByRole("dialog", { name: "Order DS-2" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close order details"));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByText("DS-1").closest("tr"), { target: screen.getByText("DS-1").closest("tr") });   // the row itself
    expect(screen.getByRole("dialog", { name: "Order DS-1" })).toBeTruthy();

    dlg = screen.getByRole("dialog");
    fireEvent.click(within(dlg).getByText("Approve and cancel order"));
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));              // answered without leaving the list
    expect(db("duchi-all")[0]).toMatchObject({ status: "Cancelled", cancelReq: { status: "approved" } });
    expect(within(screen.getByRole("dialog")).getByLabelText("Order status").value).toBe("Cancelled");
    expect(within(screen.getByRole("dialog")).getByText("Refund due")).toBeTruthy();         // a paid order cancelled: the money must go back
  });

  it("clicking a status menu in a row does not open the panel, and the dashboard rows still go to the order page", () => {
    go("/admin/orders");
    fireEvent.change(screen.getAllByLabelText("Order status")[0], { target: { value: "Dispatched" } });
    expect(screen.queryByRole("dialog")).toBeNull();
    go("/admin");
    expect(screen.getAllByText("View")[0].closest("a").getAttribute("href")).toMatch(/^\/admin\/orders\/DS-/);
  });

  it("'Adjust stock' opens the Products list already searching for that watch", () => {
    go("/admin/products?q=Axis%20Day-Date");
    expect(screen.getByLabelText("Search products").value).toBe("Axis Day-Date");
    expect(document.querySelectorAll("tbody tr").length).toBe(1);
  });
});

describe("the customer's Notifications page", () => {
  const note = (id, kind, title, text, over = {}) => ({ id, email: "jane@x.rw", orderId: "DS-1", kind, title, text, date: iso(0), read: false, ...over });
  beforeEach(() => {
    localStorage.clear(); asJane();
    seed([mk("DS-1", "Processing", { payStatus: "Paid" })]);
    localStorage.setItem("duchi-notifs", JSON.stringify([
      note("n1", "declined", "Cancellation request for order DS-1 was declined", "It was already packed and handed to the courier."),
      note("n2", "paid", "Payment received for order DS-1", "Thank you. We have confirmed your payment.", { read: true, date: iso(2) }),
      { ...note("n3", "delivered", "Order DS-9 has been delivered", "x"), email: "other@x.rw" },
    ]));
  });

  it("is a menu item with the unread count, and shows every message in full", () => {
    go("/account");
    const link = [...document.querySelectorAll(".ax-nav a")].find((a) => a.textContent.startsWith("Notifications"));
    expect(link.getAttribute("href")).toBe("/account/notifications");
    expect(link.querySelector(".ax-ct").textContent).toBe("1");
    fireEvent.click(link);
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByText("It was already packed and handed to the courier.")).toBeTruthy();   // the shop's reason, in full
    expect(screen.getByText("Thank you. We have confirmed your payment.")).toBeTruthy();
    expect(screen.queryByText("Order DS-9 has been delivered")).toBeNull();                       // someone else's
  });

  it("filters, marks as read, and opens the order", () => {
    go("/account/notifications");
    const chip = (t) => screen.getAllByRole("button").find((b) => b.className.includes("chip") && b.textContent.startsWith(t));
    expect(chip("All").textContent).toBe("All2"); expect(chip("Not read").textContent).toBe("Not read1");
    fireEvent.click(chip("Not read"));
    expect(document.querySelectorAll(".nt").length).toBe(1);
    fireEvent.click(screen.getByText("Mark as read"));
    expect(db("duchi-notifs").find((n) => n.id === "n1").read).toBe(true);
    expect(screen.getByText("You have read everything.")).toBeTruthy();
    fireEvent.click(screen.getByText("Show all messages"));
    expect(document.querySelectorAll(".nt").length).toBe(2);
    fireEvent.click(screen.getAllByText("View order DS-1")[0]);
    expect(screen.getByRole("heading", { name: "Order DS-1" })).toBeTruthy();
  });

  it("mark all as read; and the bell links to the page", () => {
    go("/account/notifications");
    fireEvent.click(screen.getByText("Mark all as read"));
    expect(db("duchi-notifs").filter((n) => n.email === "jane@x.rw").every((n) => n.read)).toBe(true);
    go("/account");
    fireEvent.click(screen.getByRole("button", { name: /^Notifications/ }));
    expect(screen.getByText("See all notifications").getAttribute("href")).toBe("/account/notifications");
  });

  it("each order lists what the shop said about it, and opening it marks those messages as read", () => {
    go("/account/orders/DS-1");
    const box = screen.getByText("Updates about this order").closest(".ac-act");
    expect(within(box).getByText("Cancellation request for order DS-1 was declined")).toBeTruthy();
    expect(within(box).getByText("It was already packed and handed to the courier.")).toBeTruthy();
    expect(within(box).getByText("Payment received for order DS-1")).toBeTruthy();
    expect(db("duchi-notifs").filter((n) => n.email === "jane@x.rw").every((n) => n.read)).toBe(true);
    expect(screen.getByRole("button", { name: /^Notifications/ }).textContent).toBe("");
  });

  it("an empty page explains itself", () => {
    localStorage.setItem("duchi-notifs", JSON.stringify([]));
    go("/account/notifications");
    expect(screen.getByText(/We will tell you here when your order is dispatched, delivered or cancelled, and when we answer a request/)).toBeTruthy();
  });
});
