import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider } from "../src/store";
import App from "../src/App";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};

const at = (t, w, m) => ({ t, w, m });
describe("Audit log search and one-field date range", () => {
  beforeAll(() => {
    localStorage.clear();
    localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role: "Admin" }));
    const rows = [at("2026-11-18T14:30:00", "admin@duchistore.rw", "Signed in"), at("2026-11-10T09:05:00", "manager@duchistore.rw", "Added product Test"), at("2026-11-10T11:00:00", "manager@duchistore.rw", "Edited product Test"), at("2026-10-01T16:45:00", "admin@duchistore.rw", "Created coupon SAVE5")];
    for (let i = 0; i < 12; i++) rows.push(at(`2026-09-${String(i + 1).padStart(2, "0")}T08:00:00`, "staff@duchistore.rw", "Stock of X " + i));
    localStorage.setItem("duchi-audit", JSON.stringify(rows));
  });
  it("searches, and picks a range in one calendar with green dots on days that have data", () => {
    render(<MemoryRouter initialEntries={["/admin/audit"]}><StoreProvider><App /></StoreProvider></MemoryRouter>);
    const rows = () => document.querySelectorAll("tbody tr").length;
    expect(rows()).toBe(10);
    expect(document.querySelectorAll('input[type="date"]').length).toBe(0); // no separate From and To inputs
    fireEvent.change(screen.getByLabelText("Search the audit log"), { target: { value: "14:30" } });
    expect(rows()).toBe(1);
    fireEvent.click(screen.getByText("Clear filters"));

    fireEvent.click(screen.getByRole("button", { name: /Select dates/ }));
    const pop = screen.getByRole("dialog", { name: "Choose dates" });
    expect(within(pop).getByText("November 2026")).toBeTruthy(); // opens on the latest day with data
    expect(pop.querySelectorAll(".dr-d.mark").length).toBe(2);   // 10 Nov and 18 Nov
    expect(within(pop).getByLabelText("10 November 2026, 2 actions")).toBeTruthy();

    fireEvent.click(within(pop).getByLabelText("10 November 2026, 2 actions"));
    expect(rows()).toBe(2); // one day only until an end day is chosen
    fireEvent.click(within(pop).getByLabelText("18 November 2026, 1 action"));
    expect(rows()).toBe(3); // 10 Nov to 18 Nov
    expect(screen.getByRole("button", { name: /10 Nov → 18 Nov/ })).toBeTruthy();
    expect(pop.querySelectorAll(".dr-c.in").length).toBe(9);

    fireEvent.click(within(pop).getByLabelText("Previous month"));
    expect(pop.querySelectorAll(".dr-d.mark").length).toBe(1); // 1 Oct
    fireEvent.click(within(pop).getByLabelText("1 October 2026, 1 action")); // a third tap starts a new range
    expect(rows()).toBe(1);
    fireEvent.click(within(pop).getByText("Clear"));
    expect(screen.getByText("Showing 1 to 10 of 16 entries")).toBeTruthy();
    fireEvent.click(within(pop).getByText("Done"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
