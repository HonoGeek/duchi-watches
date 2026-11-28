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
  pay: "MTN Mobile Money", name: "Jane Doe", phone: "0788123456", cEmail: "jane@x.rw", area: "Inside Kigali", district: "Gasabo", street: "KG 11 Ave", status, payStatus: "Pending", payPhone: "0788555123", payRef: "AB12CD34", ...over,
});
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
const asAdmin = () => localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role: "Admin" }));
const seed = (orders) => localStorage.setItem("duchi-all", JSON.stringify(orders));
const stock = () => db("duchi-products").find((p) => p.id === 0).stock;
let S;
const Probe = () => { S = useStore(); return null; };
const boot = () => { cleanup(); render(<MemoryRouter><StoreProvider><Probe /></StoreProvider></MemoryRouter>); };
const call = (fn) => { let r; act(() => { r = fn(); }); return r; };

describe("the admin can see the number the customer paid from", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); seed([mk("DS-1", "Processing"), mk("DS-2", "Processing", { pay: "Bank transfer", payPhone: "", payRef: "" })]); });

  it("the list shows the payer's number and the transaction ID, and can be searched by them", () => {
    go("/admin/orders");
    expect(screen.getByText("From 0788555123")).toBeTruthy();
    expect(screen.getByText("Ref AB12CD34")).toBeTruthy();
    const rows = () => document.querySelectorAll("tbody tr").length;
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "0788555123" } });
    expect(rows()).toBe(1);
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "ab12cd34" } });
    expect(rows()).toBe(1);
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "0788 555 123" } });   // typed with spaces
    expect(rows()).toBe(1);
  });

  it("the order shows the payment first, with everything to check before pressing Paid", async () => {
    const copied = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: copied }, configurable: true });
    go("/admin/orders");
    fireEvent.click(screen.getByRole("button", { name: "View order DS-1" }));
    const dlg = screen.getByRole("dialog");
    const first = dlg.querySelector(".odw-b .panel");
    expect(first.textContent).toContain("Payment");                                  // before the items and the contact details
    expect(within(first).getByText("RWF 95,000")).toBeTruthy();
    expect(within(first).getByText("0788555123")).toBeTruthy();
    expect(within(first).getByText("AB12CD34")).toBeTruthy();
    expect(within(first).getByText("Call").getAttribute("href")).toBe("tel:0788555123");
    expect(first.textContent).toMatch(/Sent to\s*000000/);                            // the merchant code the customer was asked to pay to
    expect(first.textContent).toContain("Press Paid only when you have seen it");
    expect(dlg.querySelector(".odw-bar .pill").textContent).toBe("Pending");          // the payment state is in the header too
    await act(async () => { fireEvent.click(within(first).getAllByText("Copy")[0]); });
    expect(copied).toHaveBeenCalledWith("0788555123");
    expect(document.querySelector(".toast").textContent).toContain("Number copied");
  });

  it("a bank transfer says what to look for instead", () => {
    go("/admin/orders/DS-2");
    expect(screen.getByText(/in your bank statement, with the order number DS-2 as the reference/)).toBeTruthy();
    expect(screen.queryByText("Paid from")).toBeNull();
  });
});

describe("a refund on a returned order puts the watches back in stock by itself", () => {
  beforeEach(() => {
    localStorage.clear(); asAdmin();
    localStorage.setItem("duchi-policies", JSON.stringify({ delivery: [], returns: [], warranty: [], terms: [], privacy: [], tracking: ["x"], returnDays: 14 }));
    seed([mk("DS-1", "Delivered", { payStatus: "Paid", deliveredAt: iso(2), returnReq: { date: iso(1), reason: "The watch has a fault", note: "", status: "approved", answer: "Send it to our shop." } })]);
  });

  it("recording the refund restocks, and takes the money off the revenue", () => {
    go("/admin/orders/DS-1");
    const tick = screen.getByLabelText(/Put the returned watches back in stock/);
    expect(tick.checked).toBe(true);                                                    // on by default
    expect(screen.queryByText(/Adjust stock/)).toBeNull();                              // no trip to the Products page
    fireEvent.submit(screen.getByText("Record refund").closest("form"));
    expect(stock()).toBe(14);                                                           // 12 + the 2 returned
    expect(db("duchi-all")[0].returnReq).toMatchObject({ status: "refunded", restock: "yes", refund: { amount: 95000 } });
    expect(screen.getByText(/were put back in stock on/)).toBeTruthy();
    expect(db("duchi-audit")[0].m).toContain("watches put back in stock");
    go("/admin");
    const rev = [...document.querySelectorAll(".kpi")].find((k) => k.querySelector(".kl").textContent === "Revenue");
    expect(rev.textContent).toContain("RWF 0");                                         // the full refund is off the revenue
    boot();
    expect(call(() => S.restockReturn("DS-1", true))).toBe(false);                      // never added twice
    expect(stock()).toBe(14);
  });

  it("unticking keeps a damaged watch out of the stock", () => {
    go("/admin/orders/DS-1");
    fireEvent.click(screen.getByLabelText(/Put the returned watches back in stock/));
    fireEvent.submit(screen.getByText("Record refund").closest("form"));
    expect(stock()).toBe(12);
    expect(db("duchi-all")[0].returnReq).toMatchObject({ status: "refunded", restock: "no" });
    expect(screen.getByText(/were not added back to the stock/)).toBeTruthy();
  });

  it("a partial refund takes only that amount off the revenue", () => {
    go("/admin/orders/DS-1");
    fireEvent.change(screen.getByLabelText(/^Refund \(RWF\)/), { target: { value: "30000" } });
    fireEvent.submit(screen.getByText("Record refund").closest("form"));
    go("/admin");
    const rev = [...document.querySelectorAll(".kpi")].find((k) => k.querySelector(".kl").textContent === "Revenue");
    expect(rev.textContent).toContain("RWF 65,000");
  });
});
