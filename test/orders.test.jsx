import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "../src/store";
import App from "../src/App";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};

const DAY = 864e5, now = Date.now();
const iso = (d) => new Date(now - d * DAY).toISOString();
const mk = (id, daysAgo, total, status, payStatus, pid = 0, email = "jane@x.rw", phone = "0788 123 456") => ({
  id, email, date: iso(daysAgo), items: [{ id: pid, q: 1, p: total - 2000 }], sub: total - 2000, disc: 0, coupon: null, fee: 2000, total,
  pay: "Card", name: "Jane Doe", phone, cEmail: email, area: "Inside Kigali", district: "G", street: "S", status, payStatus,
});
const ORDERS = [
  mk("DS-1", 0, 100000, "Delivered", "Paid"), mk("DS-2", 5, 90000, "Processing", "Pending"), mk("DS-3", 2, 80000, "Dispatched", "Paid", 1),
  mk("DS-4", 1, 70000, "Cancelled", "Pending"), mk("DS-5", 1, 60000, "Processing", "Paid", 2), mk("DS-6", 10, 50000, "Delivered", "Pending"),
];
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const ids = () => [...document.querySelectorAll("tbody tr")].map((r) => r.querySelector("td").textContent.trim());
const label = (ts) => { const d = new Date(ts); return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "long" })} ${d.getFullYear()}`; };

describe("Admin orders", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("duchi-adm", JSON.stringify({ email: "x@duchistore.rw", name: "Admin", role: "Admin" }));
    localStorage.setItem("duchi-all", JSON.stringify(ORDERS));
  });

  it("puts orders that need action first, then finished ones", () => {
    go("/admin/orders");
    expect(ids()).toEqual(["DS-5", "DS-2", "DS-3", "DS-1", "DS-6", "DS-4"]); // Processing (newest first), Dispatched, Delivered, Cancelled
    fireEvent.change(screen.getByLabelText("Sort orders"), { target: { value: "oldest" } });
    expect(ids()[0]).toBe("DS-6");
    fireEvent.change(screen.getByLabelText("Sort orders"), { target: { value: "total" } });
    expect(ids()[0]).toBe("DS-1");
  });

  it("filters by status, payment, text and date with live counts", () => {
    go("/admin/orders");
    const chip = (t) => screen.getAllByRole("button").find((b) => b.className.includes("chip") && b.textContent.startsWith(t));
    expect(chip("Processing").textContent).toBe("Processing2");
    fireEvent.click(chip("Processing"));
    expect(ids()).toEqual(["DS-5", "DS-2"]);
    fireEvent.change(screen.getByLabelText("Payment"), { target: { value: "unpaid" } });
    expect(ids()).toEqual(["DS-2"]);                                  // paid DS-5 drops out
    expect(chip("Dispatched").textContent).toBe("Dispatched0");     // the counts follow the other filters
    fireEvent.click(screen.getByText("Clear filters"));
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "0788123" } }); // phone typed without its spaces
    expect(ids().length).toBe(6);
    fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "ds-3" } });
    expect(ids()).toEqual(["DS-3"]);
    fireEvent.click(screen.getByText("Clear filters"));

    fireEvent.click(screen.getByRole("button", { name: /Select dates/ }));
    const pop = screen.getByRole("dialog", { name: "Choose dates" });
    expect(pop.querySelectorAll(".dr-d.mark").length).toBeGreaterThan(0);
    fireEvent.click(within(pop).getByLabelText(`${label(now - 2 * DAY)}, 1 action`));
    expect(ids()).toEqual(["DS-3"]);
    expect(chip("All").textContent).toBe("All1");
  });

  it("opens already filtered from the dashboard tiles", () => {
    go("/admin/orders?status=Processing");
    expect(ids()).toEqual(["DS-5", "DS-2"]);
    go("/admin/orders?pay=unpaid");
    expect(ids()).toEqual(["DS-2", "DS-6"]); // not paid and not cancelled
    go("/admin");
    expect(screen.getByText("Orders to process").closest("a").getAttribute("href")).toBe("/admin/orders?status=Processing");
    expect(screen.getByText("Payments to confirm").closest("a").getAttribute("href")).toBe("/admin/orders?pay=unpaid");
  });
});

describe("Customer orders and overview", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
    localStorage.setItem("duchi-all", JSON.stringify([...ORDERS, mk("DS-9", 3, 40000, "Delivered", "Paid", 3, "someone@else.rw")]));
  });
  const rows = () => [...document.querySelectorAll(".olist .orow")].map((r) => r.querySelector("b").textContent);

  it("overview shows progress, totals and recent orders", () => {
    go("/account");
    expect(screen.getByText("On its way")).toBeTruthy();
    expect(document.querySelectorAll(".ac-tk").length).toBe(3);                    // DS-2, DS-3, DS-5
    const stat = (l) => [...document.querySelectorAll(".stats .panel")].find((p) => p.textContent.includes(l)).textContent;
    expect(stat("Orders")).toContain("6");
    expect(stat("In progress")).toContain("3");
    expect(stat("Total spent")).toContain("RWF 380,000");                          // everything except the cancelled order
    expect(rows().length).toBe(3);
    expect(screen.getByText("View all 6 orders")).toBeTruthy();
    expect(document.querySelector(".orow-th")).toBeTruthy();                       // the watch shows in the row
  });

  it("orders page filters by status, date, search and sort", () => {
    go("/account/orders");
    expect(rows()).toEqual(["DS-1", "DS-4", "DS-5", "DS-3", "DS-2", "DS-6"]);      // newest first; only this customer's orders
    const chip = (t) => screen.getAllByRole("button").find((b) => b.className.includes("chip") && b.textContent.startsWith(t));
    fireEvent.click(chip("In progress"));
    expect(rows()).toEqual(["DS-5", "DS-3", "DS-2"]);
    fireEvent.click(chip("All"));
    fireEvent.change(screen.getByLabelText("Sort orders"), { target: { value: "active" } });
    expect(rows().slice(0, 3)).toEqual(["DS-5", "DS-3", "DS-2"]);                  // in progress first
    fireEvent.change(screen.getByLabelText("Search your orders"), { target: { value: "ds-6" } });
    expect(rows()).toEqual(["DS-6"]);
    fireEvent.click(screen.getByText("Clear filters"));
    fireEvent.click(screen.getByRole("button", { name: /Select dates/ }));
    const pop = screen.getByRole("dialog", { name: "Choose dates" });
    fireEvent.click(within(pop).getByLabelText(`${label(now - 10 * DAY)}, 1 action`));
    expect(rows()).toEqual(["DS-6"]);
    fireEvent.click(within(pop).getByText("Clear"));
    expect(rows().length).toBe(6);
  });

  it("opens on the right filter from a link, and offers To review for delivered watches", () => {
    go("/account/orders?f=review");
    expect(rows()).toEqual(["DS-1", "DS-6"]);                                      // delivered and not reviewed yet
    go("/account/orders?f=active");
    expect(rows()).toEqual(["DS-5", "DS-3", "DS-2"]);
  });
});
