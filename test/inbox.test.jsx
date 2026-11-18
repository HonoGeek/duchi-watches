import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "../src/store";
import App from "../src/App";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} unobserve() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} unobserve() {} };
Element.prototype.scrollIntoView = () => {};
window.confirm = () => true;
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const fill = (root, label, v) => fireEvent.change(within(root).getByLabelText(label), { target: { value: v } });
const db = (k) => JSON.parse(localStorage.getItem(k));
const signIn = async (email) => {
  const { container } = go("/admin");
  fill(container, "Email", email); fill(container, "Password", "admin123");
  fireEvent.submit(container.querySelector("form"));
  await waitFor(() => expect(document.querySelector(".ax-side")).toBeTruthy());
};

describe("Admin messages and email list", () => {
  beforeAll(() => { localStorage.clear(); localStorage.setItem("duchi-subscribers", JSON.stringify(["old@x.rw"])); });

  it("saves contact messages", () => {
    const { container } = go("/contact");
    const f = container.querySelector("form");
    fill(f, "Name", "Alice"); fill(f, "Email", "Alice@X.rw"); fill(f, "Phone", "0788111222"); fill(f, "Message", "Do you ship to Huye?");
    fireEvent.submit(f);
    expect(screen.getByText("Message sent")).toBeTruthy();
    expect(db("duchi-messages")[0]).toMatchObject({ name: "Alice", email: "alice@x.rw", read: false, text: "Do you ship to Huye?" });
  });

  it("newsletter keeps old emails and adds dates to new ones", () => {
    go("/");
    const input = screen.getByLabelText("Email address");
    fireEvent.change(input, { target: { value: "new@x.rw" } });
    fireEvent.submit(input.closest("form"));
    const subs = db("duchi-subscribers");
    expect(subs.map((s) => s.email)).toEqual(["old@x.rw", "new@x.rw"]);
    expect(subs[1].date).toBeTruthy();
    go("/");
    const i2 = screen.getByLabelText("Email address");
    fireEvent.change(i2, { target: { value: "NEW@x.rw" } });
    fireEvent.submit(i2.closest("form"));
    expect(db("duchi-subscribers").length).toBe(2); // duplicate ignored
  });

  it("admin sees menu items, unread badge, and can manage messages", async () => {
    await signIn("admin@duchistore.rw");
    const labels = [...document.querySelectorAll(".ax-nav .ax-a")].map((a) => a.textContent);
    expect(labels.some((l) => l.startsWith("Messages"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Email list"))).toBe(true);
    expect(document.querySelector('.ax-nav a[href$="/admin/messages"] .ax-ct').textContent).toBe("1");
    go("/admin/messages");
    expect(screen.getByText("Do you ship to Huye?")).toBeTruthy();
    expect(document.querySelector('a[href="https://wa.me/250788111222"]')).toBeTruthy();
    fireEvent.click(screen.getByText("Mark read"));
    expect(db("duchi-messages")[0].read).toBe(true);
    fireEvent.click(screen.getByText("Delete"));
    expect(db("duchi-messages").length).toBe(0);
  });

  it("email list shows, paginates, and removes", async () => {
    go("/");
    for (let k = 0; k < 11; k++) {
      cleanup(); go("/");
      const input = screen.getByLabelText("Email address");
      fireEvent.change(input, { target: { value: `p${k}@x.rw` } });
      fireEvent.submit(input.closest("form"));
    }
    expect(db("duchi-subscribers").length).toBe(13);
    go("/admin/subscribers");
    expect(document.querySelectorAll("tbody tr").length).toBe(10);
    expect(screen.getByText("Showing 1 to 10 of 13 emails")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Page 2"));
    expect(document.querySelectorAll("tbody tr").length).toBe(3);
    expect(screen.getByText("Date not recorded")).toBeTruthy(); // the legacy one is last
    fireEvent.click(screen.getAllByText("Remove")[0]);
    expect(db("duchi-subscribers").length).toBe(12);
  });

  it("staff cannot open these pages", async () => {
    localStorage.removeItem("duchi-adm");
    await signIn("staff@duchistore.rw");
    expect([...document.querySelectorAll(".ax-nav .ax-a")].map((a) => a.textContent.replace(/\d+$/, "")).join(",")).toBe("Dashboard,Orders,Products,Settings");
    go("/admin/messages"); expect(screen.getByText("Your role does not have access to this page.")).toBeTruthy();
    go("/admin/subscribers"); expect(screen.getByText("Your role does not have access to this page.")).toBeTruthy();
  });
});
