import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "../src/store";
import App from "../src/App";
import { SEED_PRODUCTS } from "../src/data";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};
window.confirm = () => true;

const DAY = 864e5, now = Date.now();
const iso = (d) => new Date(now - d * DAY).toISOString();
const order = (id, daysAgo, total, status, payStatus) => ({
  id, email: "a@x.rw", date: iso(daysAgo), items: [{ id: 0, q: 1, p: total - 2000 }], sub: total - 2000, disc: 0, coupon: null, fee: 2000, total,
  pay: payStatus === "Paid" ? "MTN Mobile Money" : "Card", name: "C", phone: "0788000000", cEmail: "a@x.rw", area: "Inside Kigali", district: "G", street: "S", status, payStatus,
});
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
const asRole = (role) => localStorage.setItem("duchi-adm", JSON.stringify({ email: "x@duchistore.rw", name: role, role }));
const label = (ts) => { const d = new Date(ts); return `${d.getDate()} ${d.toLocaleDateString("en-GB", { month: "long" })} ${d.getFullYear()}`; };

describe("Dashboard", () => {
  beforeEach(() => {
    localStorage.clear(); asRole("Admin");
    localStorage.setItem("duchi-all", JSON.stringify([
      order("A", 0, 100000, "Processing", "Paid"), order("B", 3, 50000, "Delivered", "Pending"),
      order("C", 40, 70000, "Delivered", "Pending"), order("D", 0, 99999, "Cancelled", "Pending"),
    ]));
    localStorage.setItem("duchi-messages", JSON.stringify([{ id: "m1", name: "N", email: "n@x.rw", phone: "", text: "hi", date: iso(0), read: false }]));
  });

  it("shows period cards with trends, and counts only what is not cancelled", () => {
    go("/admin");
    const card = (t) => [...document.querySelectorAll(".kpi")].find((k) => k.querySelector(".kl").textContent === t);
    expect(within(card("Revenue")).getByText("RWF 150,000")).toBeTruthy();          // A + B (D is cancelled, C is older than 30 days)
    expect(within(card("Revenue")).getByText("▲ 114%")).toBeTruthy();               // against C in the 30 days before
    expect(within(card("Orders")).getByText("2")).toBeTruthy();
    expect(within(card("Average order")).getByText("RWF 75,000")).toBeTruthy();
    expect(within(card("Awaiting payment")).getByText("RWF 120,000")).toBeTruthy(); // B + C, all time
    expect(within(card("Awaiting payment")).getByText("2 orders not marked as paid")).toBeTruthy();
    const tile = (t) => screen.getByText(t).closest("a");
    expect(tile("Orders to process").textContent).toContain("1");
    expect(tile("Payments to confirm").textContent).toContain("2");
    expect(tile("Unread messages").getAttribute("href")).toBe("/admin/messages");
    expect(tile("Reviews to approve").className).toContain("zero");
  });

  it("switches chart type, metric and period, and remembers the chart type", () => {
    const { container } = go("/admin");
    expect(container.querySelectorAll(".db-bar").length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Line" })[0]);
    expect(container.querySelector(".db-line")).toBeTruthy(); expect(container.querySelectorAll(".db-bar").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Area" }));
    expect(container.querySelector('path[fill^="url("]')).toBeTruthy();
    expect(db("duchi-dash").type).toBe("area");
    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    const last = [...container.querySelectorAll(".db-hit")].pop();
    fireEvent.click(last);
    expect(container.querySelector(".db-tip").textContent).toContain("RWF 100,000"); // today
    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    expect(screen.getByText("Orders by day")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Revenue" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    expect(screen.getByText("Revenue by week")).toBeTruthy();
    expect(within([...document.querySelectorAll(".kpi")][0]).getByText("RWF 220,000")).toBeTruthy(); // C is inside 90 days
    cleanup();
    const again = go("/admin");
    expect(again.container.querySelectorAll(".db-bar").length).toBeGreaterThan(0);
    expect(db("duchi-dash")).toMatchObject({ type: "bar", preset: 90 });
  });

  it("breaks sales down as a donut or as bars", () => {
    const { container } = go("/admin");
    expect(container.querySelector(".db-donut")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bars" }));
    expect(container.querySelector(".db-hb")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Break down by"), { target: { value: "pay" } });
    const names = () => [...container.querySelectorAll(".db-hb .t span")].map((x) => x.textContent);
    expect(names()).toEqual(expect.arrayContaining(["Card", "MTN Mobile Money"]));
    fireEvent.change(screen.getByLabelText("Break down by"), { target: { value: "status" } });
    expect(names()).toContain("Cancelled"); // order status includes cancelled orders
  });

  it("shows staff only the tiles for pages they can open", () => {
    asRole("Staff");
    go("/admin");
    const labels = [...document.querySelectorAll(".db-at")].map((a) => a.textContent);
    expect(labels.length).toBe(3);
    expect(labels.some((t) => t.includes("Unread messages") || t.includes("Reviews"))).toBe(false);
  });
});

describe("Products: added and updated dates", () => {
  const prods = () => SEED_PRODUCTS.map((p, i) => (
    i === 1 ? { ...p, createdAt: now - 20 * DAY, updatedAt: now - 2 * DAY, updatedBy: "Manager" }
      : i === 2 ? { ...p, createdAt: now - 9 * DAY, updatedAt: now - 9 * DAY, updatedBy: "Admin" } : p));
  beforeEach(() => { localStorage.clear(); asRole("Admin"); localStorage.setItem("duchi-products", JSON.stringify(prods())); });

  it("lists both dates, sorts, and filters by added or updated day with one picker", () => {
    go("/admin/products");
    expect(screen.getAllByText("Date not recorded").length).toBe(12); // 6 older demo products, 2 lines each
    expect(screen.getAllByText("Not updated yet").length).toBe(1);
    expect(screen.getByText(/· Manager/)).toBeTruthy();
    expect(document.querySelectorAll("tbody tr")[0].textContent).toContain("Ignite Chronograph"); // newest added first

    fireEvent.change(screen.getByLabelText("Sort products"), { target: { value: "updated" } });
    expect(document.querySelectorAll("tbody tr")[0].textContent).toContain("Icon Diver");           // updated 2 days ago

    fireEvent.change(screen.getByLabelText("Filter by which date"), { target: { value: "updated" } });
    fireEvent.click(screen.getByRole("button", { name: /Select dates/ }));
    const pop = screen.getByRole("dialog", { name: "Choose dates" });
    expect(pop.querySelectorAll(".dr-d.mark").length).toBeGreaterThan(0);
    fireEvent.click(within(pop).getByLabelText(`${label(now - 2 * DAY)}, 1 action`));
    expect(document.querySelectorAll("tbody tr").length).toBe(1);                                    // updated on that day
    fireEvent.change(screen.getByLabelText("Filter by which date"), { target: { value: "added" } });
    expect(screen.getByText("No products match your filters.")).toBeTruthy();                       // nothing was added that day
    fireEvent.click(screen.getByText("Clear filters"));
    expect(document.querySelectorAll("tbody tr").length).toBe(8);
  });

  it("records the dates when admin adds a product and changes stock", () => {
    go("/admin/products");
    fireEvent.click(screen.getByText("Add product"));
    const pf = screen.getByText("Save product").closest("form");
    fireEvent.click(within(pf).getByText("Use sample photos instead"));
    fireEvent.change(within(pf).getByLabelText("Name"), { target: { value: "Dated Watch" } });
    fireEvent.change(within(pf).getByLabelText("Dial or colour"), { target: { value: "Blue" } });
    fireEvent.change(within(pf).getByLabelText("Price in RWF"), { target: { value: "99000" } });
    fireEvent.submit(pf);
    const added = db("duchi-products").at(-1);
    expect(added.createdAt).toBeGreaterThan(now - 1000);
    expect(added.updatedAt).toBe(added.createdAt);
    expect(added.updatedBy).toBe("Admin");
    expect(screen.getAllByText("Not updated yet").length).toBe(2); // Ignite Chronograph and the new one

    const input = screen.getByLabelText("Stock of Dated Watch");
    fireEvent.change(input, { target: { value: "20" } }); fireEvent.blur(input);
    const after = db("duchi-products").at(-1);
    expect(after.stock).toBe(20);
    expect(after.createdAt).toBe(added.createdAt);                    // creation time never changes
    expect(after.updatedAt).toBeGreaterThanOrEqual(added.updatedAt);
  });
});
