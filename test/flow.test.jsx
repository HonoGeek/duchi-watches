import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "../src/store";
import App from "../src/App";

window.scrollTo = () => {};
const go = (path, state) => {
  cleanup();
  return render(<MemoryRouter initialEntries={[state ? { pathname: path, state } : path]}><StoreProvider><App /></StoreProvider></MemoryRouter>);
};
const fill = (root, label, v) => fireEvent.change(within(root).getByLabelText(label), { target: { value: v } });
const db = (k) => JSON.parse(localStorage.getItem(k));
let orderId;

describe("DUCHI STORE flows", () => {
  beforeAll(() => localStorage.clear());

  it("renders storefront pages", () => {
    go("/"); expect(screen.getByRole("heading", { name: "Time, well kept." })).toBeTruthy();
    expect(document.querySelectorAll(".ti svg").length).toBe(4);
    expect(screen.getByText("Why choose us over others?")).toBeTruthy();
    expect(screen.getByText("Customer reviews")).toBeTruthy();
    expect(document.querySelectorAll(".rcw").length).toBe(6);
    fireEvent.click(screen.getByLabelText("Open menu")); expect(document.querySelector(".links").className).toContain("open");
    expect(screen.getByLabelText("Close menu").className).toContain("x");
    fireEvent.click(screen.getByLabelText("Close menu")); expect(document.querySelector(".links").className).not.toContain("open");
    go("/shop"); expect(screen.getByText("8 watches")).toBeTruthy();
    go("/product/2"); expect(screen.getAllByText("Ignite Chronograph").length).toBeGreaterThan(0);
    expect(document.querySelector(".buybar")).toBeTruthy(); expect(document.body.classList.contains("has-buybar")).toBe(true);
    go("/contact"); expect(screen.getByText("How can we help?")).toBeTruthy();
  });

  it("requires sign in at checkout, applies coupon, places order", () => {
    go("/product/0"); fireEvent.click(screen.getAllByText("Add to cart")[0]);
    expect(db("duchi-cart")).toEqual([{ id: 0, q: 1 }]);
    const { container } = go("/checkout");
    expect(screen.getByText("Sign in to check out")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    const form = container.querySelector("form");
    fill(form, "Full name", "Jane Doe"); fill(form, "Email", "jane@x.rw"); fill(form, "Phone number", "0788000000"); fill(form, "Password", "secret1");
    fireEvent.submit(form);
    expect(screen.getByText("Order summary")).toBeTruthy();
    expect(screen.getByDisplayValue("Jane Doe")).toBeTruthy();
    const co = container.querySelector("form");
    fill(co, "District", "Gasabo"); fill(co, "Delivery address", "KG 11 Ave");
    fill(co, "Coupon code", "welcome10"); fireEvent.click(screen.getByText("Apply"));
    expect(screen.getByText("−RWF 9,500")).toBeTruthy();
    fireEvent.submit(co);
    expect(screen.getByText("Thank you, order received.")).toBeTruthy();
    const o = db("duchi-all")[0]; orderId = o.id;
    expect(o.total).toBe(95000 - 9500 + 2000);
    expect(db("duchi-products")[0].stock).toBe(11);
    expect(db("duchi-cart")).toEqual([]);
  });

  it("customer dashboard works", () => {
    go("/account"); expect(screen.getByText("Hi, Jane")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Open account menu")); expect(document.querySelector(".dnav").className).toContain("open");
    expect(screen.getByLabelText("Close account menu").className).toContain("x");
    fireEvent.click(screen.getByLabelText("Close account menu")); expect(document.querySelector(".dnav").className).not.toContain("open");
    go("/account/orders"); expect(screen.getByText(orderId)).toBeTruthy();
    go("/account/orders/" + orderId); expect(screen.getByText("Processing")).toBeTruthy();
    go("/shop"); fireEvent.click(screen.getAllByLabelText("Save to wishlist")[0]);
    go("/account/wishlist"); expect(document.querySelectorAll(".card").length).toBe(1);
    const { container } = go("/account/addresses");
    fireEvent.click(screen.getByText("Add address"));
    const f = container.querySelector("form");
    fill(f, "Label", "Home"); fill(f, "District", "Kicukiro"); fill(f, "Street and landmark", "KK 5 Rd");
    fireEvent.submit(f);
    expect(document.querySelectorAll(".panel.row b").length).toBe(1);
    go("/account/profile");
    const pf = document.querySelector("form"); fill(pf, "Full name", "Jane D"); fireEvent.submit(pf);
    expect(db("duchi-user").name).toBe("Jane D");
  });

  it("admin dashboard works end to end", () => {
    const { container } = go("/admin");
    fill(container, "Email", "admin@duchistore.rw"); fill(container, "Password", "admin123");
    fireEvent.submit(container.querySelector("form"));
    expect(screen.getByText("Revenue, last 7 days")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Open admin menu")); expect(document.querySelector(".admenu").className).toContain("open");
    fireEvent.click(screen.getByLabelText("Close admin menu")); expect(document.querySelector(".admenu").className).not.toContain("open");
    go("/admin/orders");
    expect(document.querySelector("tbody td").getAttribute("data-label")).toBe("Order");
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "Cancelled" } });
    expect(db("duchi-products")[0].stock).toBe(12);
    go("/admin/products"); fireEvent.click(screen.getByText("Add product"));
    const pf = screen.getByText("Save product").closest("form");
    fill(pf, "Name", "Test Watch"); fill(pf, "Dial or colour", "Green"); fill(pf, "Price (RWF)", "120000"); fill(pf, "Stock", "3");
    fireEvent.submit(pf);
    expect(db("duchi-products").length).toBe(9);
    go("/admin/coupons"); const cf = screen.getByText("Create coupon").closest("form");
    fill(cf, "Code", "save5"); fill(cf, "Value", "5000"); fireEvent.submit(cf);
    expect(db("duchi-coupons").length).toBe(2);
    go("/admin/shipping"); const sf = screen.getByText("Save shipping").closest("form");
    fireEvent.change(within(sf).getAllByLabelText("Fee (RWF)")[0], { target: { value: "2500" } }); fireEvent.submit(sf);
    go("/"); expect(document.querySelector(".top").textContent).toContain("Inside Kigali RWF 2,500");
    go("/admin/team"); const tf = screen.getByText("Add member").closest("form");
    fill(tf, "Name", "Eric"); fill(tf, "Email", "eric@x.rw"); fireEvent.submit(tf);
    expect(db("duchi-staff").length).toBe(4);
    go("/admin/audit"); expect(document.querySelectorAll("tbody tr").length).toBeGreaterThanOrEqual(6);
    go("/account/orders"); expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("payments: mobile money dial buttons, Stripe card form, contact details for admin", async () => {
    go("/product/1"); fireEvent.click(screen.getAllByText("Add to cart")[0]);
    const { container } = go("/checkout");
    let dial = container.querySelector("a.dial");
    expect(dial.getAttribute("href")).toBe("tel:*182*8*1*000000%23");
    fireEvent.click(screen.getByLabelText("Airtel Money"));
    expect(container.querySelector("a.dial").getAttribute("href")).toBe("tel:*500%23");
    fireEvent.click(screen.getByLabelText("Card"));
    const f = container.querySelector("form");
    fill(f, "District", "Nyarugenge"); fill(f, "Delivery address", "KN 5 Rd");
    fill(f, "Phone number", "0788123456"); fill(f, "Email", "buyer@x.rw");
    fireEvent.submit(f); // card details missing: must not place the order
    await waitFor(() => expect(document.querySelector(".toast").textContent).toContain("valid card number"));
    expect(db("duchi-all").length).toBe(1);
    fill(f, "Card number", "4242424242424242"); fill(f, "Expiry (MM/YY)", "12/28"); fill(f, "Security code", "123");
    fireEvent.submit(f);
    await waitFor(() => expect(screen.getByText("Thank you, order received.")).toBeTruthy(), { timeout: 2000 });
    {
      const o = db("duchi-all")[0];
      expect(o.cEmail).toBe("buyer@x.rw"); expect(o.phone).toBe("0788123456");
      expect(o.pay).toBe("Card"); expect(o.card.last4).toBe("4242"); expect(o.payRef.startsWith("preview_")).toBe(true);
      expect(JSON.stringify(o)).not.toContain("4242424242424242");
      go("/admin/orders");
      expect(document.querySelector('tbody a[href="tel:0788123456"]')).toBeTruthy();
      expect(document.querySelector('tbody a[href="mailto:buyer@x.rw"]')).toBeTruthy();
      go("/admin/orders/" + o.id);
      expect(document.querySelector('a[href="https://wa.me/250788123456"]')).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Payment status"), { target: { value: "Paid" } });
      expect(db("duchi-all")[0].payStatus).toBe("Paid");
      go("/admin/payments");
      const pf = screen.getByText("Save payment settings").closest("form");
      fireEvent.change(within(pf).getAllByLabelText("Merchant code")[0], { target: { value: "654321" } });
      fireEvent.submit(pf);
      expect(db("duchi-paycfg").mtn.code).toBe("654321");
    }
  });

  it("staff role is limited", () => {
    go("/admin"); fireEvent.click(screen.getAllByText("Sign out")[0]);
    const { container } = go("/admin");
    fill(container, "Email", "staff@duchistore.rw"); fill(container, "Password", "admin123");
    fireEvent.submit(container.querySelector("form"));
    expect([...document.querySelectorAll(".adnav a")].map((a) => a.textContent).join(",")).toBe("Dashboard,Orders,Products");
    go("/admin/team"); expect(screen.getByText("Your role does not have access to this page.")).toBeTruthy();
  });

  it("new sections: videos, review photos, filters, stock left, cart toast, specs", async () => {
    go("/"); expect(document.querySelectorAll(".vrow .vc").length).toBe(4);
    expect(document.querySelectorAll(".rc .rimg").length).toBe(2);

    go("/shop");
    fireEvent.click(screen.getByLabelText("List view")); expect(document.querySelectorAll(".card.list").length).toBe(9);
    fireEvent.click(screen.getByLabelText("Grid view")); expect(document.querySelectorAll(".card.list").length).toBe(0);
    fireEvent.change(screen.getByLabelText("Price range"), { target: { value: "1" } });
    const under = document.querySelectorAll(".card").length;
    expect(under).toBeGreaterThan(0); expect(under).toBeLessThan(9);
    fireEvent.click(screen.getByText("Clear filters")); expect(screen.getByText("9 watches")).toBeTruthy();

    go("/product/2"); expect(document.querySelector(".stk")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Add to cart")[0]);
    await waitFor(() => expect(document.querySelector(".toast").textContent).toContain("1 × Ignite Chronograph added to cart"));
    go("/cart"); expect(document.querySelector(".stk").textContent).toMatch(/in stock|left in stock/);
    go("/checkout"); expect(document.querySelector(".sum .stk")).toBeTruthy();

    // admin: spec fields and Videos page
    go("/admin"); fireEvent.click(screen.getAllByText("Sign out")[0]); // previous test left a staff user signed in
    const { container } = go("/admin");
    fill(container, "Email", "admin@duchistore.rw"); fill(container, "Password", "admin123");
    fireEvent.submit(container.querySelector("form"));
    go("/admin/products"); fireEvent.click(screen.getByText("Add product"));
    const pf = screen.getByText("Save product").closest("form");
    fill(pf, "Name", "Spec Watch"); fill(pf, "Dial or colour", "Blue"); fill(pf, "Price (RWF)", "99000"); fill(pf, "Stock", "4");
    fill(pf, "Movement", "Automatic"); fireEvent.submit(pf);
    expect(db("duchi-products").at(-1).spec.movement).toBe("Automatic");
    go("/product/" + (db("duchi-products").length - 1)); expect(screen.getByText("Automatic")).toBeTruthy();
    go("/admin/videos"); const vf = screen.getByText("Save videos").closest("form");
    fireEvent.change(within(vf).getAllByLabelText("Video link (.mp4)")[0], { target: { value: "https://x.rw/a.mp4" } }); fireEvent.submit(vf);
    expect(db("duchi-videos")[0].src).toBe("https://x.rw/a.mp4");
    go("/"); expect(document.querySelector(".vrow .vplay svg")).toBeTruthy();
  });
});
