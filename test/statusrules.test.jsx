import { describe, it, expect, beforeEach, vi } from "vitest";
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
const asAdmin = () => localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role: "Admin" }));
const seed = (orders) => localStorage.setItem("duchi-all", JSON.stringify(orders));
const status = () => db("duchi-all")[0].status;
const change = (label, v) => fireEvent.change(screen.getByLabelText(label), { target: { value: v } });
const question = () => screen.getByRole("alertdialog").textContent;
const stock = () => db("duchi-products").find((p) => p.id === 0).stock;
let S;
const Probe = () => { S = useStore(); return null; };
const boot = () => { cleanup(); render(<MemoryRouter><StoreProvider><Probe /></StoreProvider></MemoryRouter>); };
const call = (fn) => { let r; act(() => { r = fn(); }); return r; };

describe("every status change asks first, and moves that make no sense are refused", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); });

  it("an allowed move shows what will happen; 'No' changes nothing, 'Yes' does it", () => {
    seed([mk("DS-1", "Processing")]);
    go("/admin/orders/DS-1");
    change("Order status", "Dispatched");
    expect(question()).toContain("Mark order DS-1 as dispatched? The customer is told it is on its way.");
    expect(status()).toBe("Processing");
    fireEvent.click(screen.getByRole("button", { name: "No, keep it" }));
    expect(status()).toBe("Processing");
    change("Order status", "Dispatched");
    fireEvent.click(screen.getByRole("button", { name: "Yes, mark dispatched" }));
    expect(status()).toBe("Dispatched");
    change("Order status", "Delivered");
    expect(question()).toContain("The customer is invited to review it");
    fireEvent.click(screen.getByRole("button", { name: "Yes, mark delivered" }));
    expect(status()).toBe("Delivered");
  });

  it("going back from Dispatched to Processing is allowed with a warning, and the customer is told", () => {
    seed([mk("DS-1", "Dispatched")]);
    go("/admin/orders/DS-1");
    change("Order status", "Processing");
    expect(question()).toContain("Move order DS-1 back to Processing?");
    fireEvent.click(screen.getByRole("button", { name: "Yes, move back" }));
    expect(status()).toBe("Processing");
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "processing", title: "Order DS-1 is being prepared again" });
  });

  it("a delivered order cannot be changed: an error explains why and nothing moves", () => {
    seed([mk("DS-1", "Delivered", { deliveredAt: iso(5), payStatus: "Paid" })]);
    go("/admin/orders/DS-1");
    for (const to of ["Processing", "Dispatched", "Cancelled"]) {
      change("Order status", to);
      expect(document.querySelector(".toast.err").textContent).toContain("A delivered order cannot be changed");
      expect(document.querySelector(".toast.ask")).toBeNull();
      expect(status()).toBe("Delivered");
    }
    expect(screen.getByLabelText("Order status").value).toBe("Delivered");
  });

  it("a delivery marked by mistake can be undone within a day, with a notice to the customer", () => {
    seed([mk("DS-1", "Delivered", { deliveredAt: iso(0.1) })]);
    go("/admin/orders/DS-1");
    change("Order status", "Dispatched");
    expect(question()).toContain("It was marked delivered less than a day ago");
    fireEvent.click(screen.getByRole("button", { name: "Yes, move back" }));
    expect(db("duchi-all")[0]).toMatchObject({ status: "Dispatched", deliveredAt: null });
    expect(db("duchi-notifs")[0]).toMatchObject({ title: "Order DS-1: status corrected" });
    seed([mk("DS-1", "Delivered", { deliveredAt: iso(0.1), returnReq: { status: "pending", reason: "x", date: iso(0) } })]);
    boot();
    expect(call(() => S.setOrderStatus("DS-1", "Dispatched"))).toBe(false);          // a return was asked for: no going back
  });

  it("a cancelled order must be reopened first, and only when the stock allows it", () => {
    seed([mk("DS-1", "Cancelled")]);
    go("/admin/orders/DS-1");
    change("Order status", "Dispatched");
    expect(document.querySelector(".toast.err").textContent).toContain("must be reopened first");
    change("Order status", "Processing");
    expect(question()).toContain("Reopen order DS-1? The watches are taken out of the stock again");
    fireEvent.click(screen.getByRole("button", { name: "Yes, reopen order" }));
    expect(status()).toBe("Processing");
    expect(stock()).toBe(10);                                                          // 12 - 2: taken out again
    expect(db("duchi-all")[0]).toMatchObject({ restockedAt: null, cancelledBy: null });
  });

  it("reopening is refused when there is not enough stock, or when a refund was recorded", () => {
    seed([mk("DS-1", "Cancelled")]);
    boot();
    call(() => S.setStock(0, 1));                                                      // only 1 left, the order needs 2
    go("/admin/orders/DS-1");
    change("Order status", "Processing");
    expect(document.querySelector(".toast.err").textContent).toContain("Cannot reopen: only 1 of Axis Day-Date left in stock, and the order needs 2");
    expect(status()).toBe("Cancelled");
    seed([mk("DS-1", "Cancelled", { refund: { amount: 95000, method: "", date: iso(1) } })]);
    boot();
    expect(call(() => S.setOrderStatus("DS-1", "Processing"))).toBe(false);
    expect(S.toast.msg).toContain("A refund was recorded");
  });

  it("the store enforces the same rules, so no other screen can bypass them", () => {
    seed([mk("DS-1", "Delivered", { deliveredAt: iso(9) }), mk("DS-2", "Cancelled")]);
    boot();
    expect(call(() => S.setOrderStatus("DS-1", "Processing"))).toBe(false);
    expect(call(() => S.setOrderStatus("DS-2", "Delivered"))).toBe(false);
    expect(db("duchi-all").map((o) => o.status)).toEqual(["Delivered", "Cancelled"]);
  });
});

describe("payment status changes check the money first", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); seed([mk("DS-1", "Processing", { payRef: "AB12CD34" })]); });

  it("'Paid' names the amount, the number and the reference to look for", () => {
    go("/admin/orders/DS-1");
    change("Payment status", "Paid");
    const q = question();
    expect(q).toContain("RWF 95,000");
    expect(q).toContain("MTN Mobile Money from 0788123456, reference AB12CD34");
    expect(db("duchi-all")[0].payStatus).toBe("Pending");
    fireEvent.click(screen.getByRole("button", { name: "Yes, payment received" }));
    expect(db("duchi-all")[0].payStatus).toBe("Paid");
    change("Payment status", "Pending");
    expect(question()).toContain("It will show as not paid again");
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(db("duchi-all")[0].payStatus).toBe("Paid");
    change("Payment status", "Failed");
    expect(question()).toContain("The customer is told we could not confirm it");
  });
});
