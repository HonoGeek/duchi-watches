import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  id, email: "jane@x.rw", date: iso(3), items: [{ id: 0, q: 1, p: 93000, n: "Axis Day-Date", c: "Steel" }], sub: 93000, disc: 0, coupon: null, fee: 2000, total: 95000,
  pay: "MTN Mobile Money", name: "Jane Doe", phone: "0788123456", cEmail: "jane@x.rw", area: "Inside Kigali", district: "Gasabo", street: "KG 11 Ave", status, payStatus: "Pending", payPhone: "0788123456", ...over,
});
const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
const asJane = () => localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
const asAdmin = (role = "Admin") => localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role }));
const seed = (orders) => localStorage.setItem("duchi-all", JSON.stringify(orders));
const setPolicies = (over) => localStorage.setItem("duchi-policies", JSON.stringify({ delivery: [], returns: [], warranty: [], terms: [], privacy: [], tracking: ["Sign in to track."], returnDays: 0, ...over }));
const byLabel = (root, l) => within(root).getByLabelText(typeof l === "string" ? new RegExp("^" + l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : l);
const type = (root, l, v) => fireEvent.change(byLabel(root, l), { target: { value: v } });
let S;
const Probe = () => { S = useStore(); return null; };
const boot = () => { cleanup(); render(<MemoryRouter><StoreProvider><Probe /></StoreProvider></MemoryRouter>); };
const call = (fn) => { let r; act(() => { r = fn(); }); return r; };
afterEach(() => vi.restoreAllMocks());

describe("asking to cancel an order", () => {
  beforeEach(() => { localStorage.clear(); asJane(); seed([mk("DS-1", "Processing")]); });

  it("the customer asks, the admin sees it and approves: the order is cancelled and stock comes back", () => {
    go("/account/orders/DS-1");
    fireEvent.click(screen.getByText("Request cancellation"));
    const f = document.querySelector(".ac-act form");
    fireEvent.submit(f);
    expect(screen.getByText("Please tell us briefly why you want to cancel.")).toBeTruthy();
    expect(db("duchi-all")[0].cancelReq).toBeUndefined();
    type(f, "Why do you want to cancel", "I ordered the wrong watch");
    fireEvent.submit(f);
    expect(db("duchi-all")[0].cancelReq).toMatchObject({ status: "pending", reason: "I ordered the wrong watch" });
    expect(screen.getByText(/You asked to cancel this order/)).toBeTruthy();
    expect(screen.queryByText("Request cancellation")).toBeNull();                       // one open request at a time
    boot();
    expect(call(() => S.requestCancel("DS-1", "again please"))).toBe(false);

    asAdmin();
    go("/admin/orders");
    expect(screen.getByText("Cancel request")).toBeTruthy();                             // a badge in the list
    expect(screen.getByRole("button", { name: /^Requests/ }).textContent).toBe("Requests1");
    go("/admin/orders?req=1");
    expect(document.querySelectorAll("tbody tr").length).toBe(1);
    go("/admin");
    expect(screen.getByText("Requests to answer").closest("a").getAttribute("href")).toBe("/admin/orders?req=1");
    go("/admin/orders/DS-1");
    expect(screen.getByText("I ordered the wrong watch")).toBeTruthy();
    fireEvent.click(screen.getByText("Approve and cancel order"));
    expect(screen.getByRole("alertdialog").textContent).toContain("Approve the request and cancel order DS-1?");
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel order" }));
    expect(db("duchi-all")[0]).toMatchObject({ status: "Cancelled", cancelReq: { status: "approved" } });
    expect(db("duchi-products")[0].stock).toBe(13);
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "cancelled", email: "jane@x.rw" });
  });

  it("declining needs a reason the customer can read, and they may ask again", () => {
    boot();
    call(() => S.requestCancel("DS-1", "Changed my mind"));
    asAdmin();
    boot();
    expect(call(() => S.answerCancel("DS-1", false, "no"))).toBe(false);
    expect(call(() => S.answerCancel("DS-1", false, "It was already packed and handed to the courier."))).toBe(true);
    expect(db("duchi-all")[0].status).toBe("Processing");
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "declined", title: "Cancellation request for order DS-1 was declined", text: "It was already packed and handed to the courier." });
    go("/account/orders/DS-1");
    expect(screen.getByText(/Your cancellation request was declined: It was already packed/)).toBeTruthy();
    expect(screen.getByText("Request cancellation")).toBeTruthy();
  });

  it("is not offered once the order is on its way", () => {
    seed([mk("DS-1", "Dispatched", { payStatus: "Paid" })]);
    go("/account/orders/DS-1");
    expect(screen.queryByText("Cancel this order")).toBeNull();
    boot();
    expect(call(() => S.requestCancel("DS-1", "too slow"))).toBe(false);
  });
});

describe("sending the payment details again", () => {
  beforeEach(() => { localStorage.clear(); asJane(); seed([mk("DS-1", "Processing", { payStatus: "Failed" })]); });

  it("a failed payment can be resent with another number or another method", () => {
    go("/account/orders/DS-1");
    expect(screen.getByText("We could not confirm your payment")).toBeTruthy();
    fireEvent.click(screen.getByText("Send payment details again"));
    const f = document.querySelector(".ac-act form");
    const methods = [...within(f).getByLabelText(/^Pay with/).options].map((x) => x.textContent);
    expect(methods).toEqual(["MTN Mobile Money", "Airtel Money", "Bank transfer"]);          // card is not offered here
    type(f, "Number you paid from", "");
    fireEvent.submit(f);
    expect(screen.getByText("Enter the phone number you paid from, so we can match your payment.")).toBeTruthy();
    type(f, "Pay with", "Airtel Money");
    type(f, "Number you paid from", "+250 733 000 111");
    type(f, "Transaction ID", "AB12CD34");
    fireEvent.submit(f);
    expect(db("duchi-all")[0]).toMatchObject({ pay: "Airtel Money", payPhone: "0733000111", payRef: "AB12CD34", payStatus: "Pending" });
    expect(db("duchi-all")[0].payUpdatedAt).toBeTruthy();
    expect(screen.getByText("Payment not confirmed yet")).toBeTruthy();
    asAdmin();
    go("/admin/orders/DS-1");
    expect(screen.getByText(/The customer sent the payment details again/)).toBeTruthy();
  });

  it("bank transfer clears the mobile money details; paid, cancelled and other people's orders are refused", () => {
    boot();
    expect(call(() => S.updateOrderPayment("DS-1", { pay: "Bank transfer", payPhone: "0788123456", payRef: "X1234" }))).toBe(true);
    expect(db("duchi-all")[0]).toMatchObject({ pay: "Bank transfer", payPhone: "", payRef: "" });
    expect(call(() => S.updateOrderPayment("DS-1", { pay: "Card", payPhone: "", payRef: "" }))).toBe(false);
    expect(call(() => S.updateOrderPayment("DS-1", { pay: "MTN Mobile Money", payPhone: "12", payRef: "" }))).toBe(false);
    seed([mk("DS-1", "Processing", { payStatus: "Paid" }), mk("DS-2", "Cancelled"), mk("DS-3", "Processing", { email: "someone@else.rw" })]);
    boot();
    for (const id of ["DS-1", "DS-2", "DS-3"]) expect(call(() => S.updateOrderPayment(id, { pay: "Bank transfer", payPhone: "", payRef: "" }))).toBe(false);
    go("/account/orders/DS-1");
    expect(screen.queryByText("Payment not confirmed yet")).toBeNull();                       // a paid order shows no payment box
  });
});

describe("returns and refunds, with policies the owner writes", () => {
  beforeEach(() => { localStorage.clear(); asJane(); seed([mk("DS-1", "Delivered", { payStatus: "Paid", deliveredAt: iso(2) })]); });

  it("stays closed until a return period is set, and asks the customer to contact the shop", () => {
    go("/account/orders/DS-1");
    expect(screen.getByText(/To return or exchange a watch, please/)).toBeTruthy();
    expect(screen.queryByText("Request a return")).toBeNull();
    boot();
    expect(call(() => S.requestReturn("DS-1", { reason: "The watch has a fault", note: "" }))).toBe(false);
    go("/help");
    expect(screen.getAllByText(/We are finalising this information/).length).toBeGreaterThan(0);   // nothing is invented
  });

  it("the owner sets the policies; they appear on Help and on the home page", () => {
    asAdmin();
    const { container } = go("/admin/policies");
    const f = container.querySelector("form");
    type(f, "Return period", "100");
    fireEvent.submit(f);
    expect(db("duchi-policies").returnDays).toBe(0);                                          // 100 days is refused, nothing changed
    type(f, "Return period", "14");
    fireEvent.change(within(f).getByLabelText("Delivery"), { target: { value: "Kigali: same or next day.\n\n  Other districts: 2 to 3 days. " } });
    fireEvent.change(within(f).getByLabelText("Returns and exchanges"), { target: { value: "Watches must be unworn and in the box." } });
    fireEvent.submit(f);
    expect(db("duchi-policies")).toMatchObject({ returnDays: 14, delivery: ["Kigali: same or next day.", "Other districts: 2 to 3 days."], returns: ["Watches must be unworn and in the box."] });
    go("/help");
    expect(screen.getByText("Kigali: same or next day.")).toBeTruthy();
    expect(screen.getByText(/within 14 days of delivery/)).toBeTruthy();
    go("/");
    expect(screen.getByText("How long does delivery take?")).toBeTruthy();
  });

  it("the whole return: request, approve, refund, revenue and notes", () => {
    setPolicies({ returnDays: 14, returns: ["Unworn and in the box."] });
    go("/account/orders/DS-1");
    fireEvent.click(screen.getByText("Request a return"));
    const f = document.querySelector(".ac-act form");
    fireEvent.submit(f);
    expect(screen.getByText("Choose a reason for the return.")).toBeTruthy();
    type(f, "Reason", "The watch has a fault");
    type(f, "Anything we should know", "It stops after an hour.");
    fireEvent.submit(f);
    expect(db("duchi-all")[0].returnReq).toMatchObject({ status: "pending", reason: "The watch has a fault", note: "It stops after an hour." });
    expect(screen.getByText(/You asked to return this order/)).toBeTruthy();
    boot();
    expect(call(() => S.requestReturn("DS-1", { reason: "I changed my mind", note: "" }))).toBe(false);   // only one request

    asAdmin();
    go("/admin/orders/DS-1");
    expect(screen.getByText("Waiting for you")).toBeTruthy();
    fireEvent.click(screen.getByText("Decline"));
    expect(db("duchi-all")[0].returnReq.status).toBe("pending");                             // a reason is needed to decline
    fireEvent.change(screen.getByLabelText(/^Message to the customer/), { target: { value: "Please send the watch to our shop in Kigali." } });
    fireEvent.click(screen.getByText("Approve return"));
    expect(db("duchi-all")[0].returnReq).toMatchObject({ status: "approved", answer: "Please send the watch to our shop in Kigali." });
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "approved", text: "Please send the watch to our shop in Kigali." });

    const refund = screen.getByText("Record refund").closest("form");
    type(refund, "Refund (RWF)", "999999");
    fireEvent.submit(refund);
    expect(db("duchi-all")[0].returnReq.status).toBe("approved");                            // more than the order total is refused
    type(refund, "Refund (RWF)", "95000"); type(refund, "How it was sent", "MTN MoMo to 0788 123 456");
    fireEvent.submit(refund);
    expect(db("duchi-all")[0].returnReq).toMatchObject({ status: "refunded", refund: { amount: 95000, method: "MTN MoMo to 0788 123 456" } });
    expect(db("duchi-notifs")[0]).toMatchObject({ kind: "refunded", title: "Refund recorded for order DS-1" });

    go("/admin");                                                                            // the refund comes off the revenue
    const rev = [...document.querySelectorAll(".kpi")].find((k) => k.querySelector(".kl").textContent === "Revenue");
    expect(rev.textContent).toContain("RWF 0");
    go("/account/orders/DS-1");
    expect(screen.getByText(/We recorded a refund of RWF 95,000 \(MTN MoMo to 0788 123 456\)/)).toBeTruthy();
  });

  it("is refused outside the return period", () => {
    setPolicies({ returnDays: 14 });
    seed([mk("DS-1", "Delivered", { payStatus: "Paid", deliveredAt: iso(30) })]);
    go("/account/orders/DS-1");
    expect(screen.getByText(/The 14-day return period for this order has ended/)).toBeTruthy();
    boot();
    expect(call(() => S.requestReturn("DS-1", { reason: "The watch has a fault", note: "" }))).toBe(false);
    expect(S.toast.msg).toContain("return period");
  });

  it("only Admin and Manager can edit policies", () => {
    asAdmin("Staff");
    go("/admin/policies");
    expect(screen.getByText("Your role does not have access to this page.")).toBeTruthy();
  });
});

describe("telling the customer by WhatsApp or SMS", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); seed([mk("DS-1", "Processing", { payStatus: "Paid" })]); });
  it("the order page has ready-to-send messages that follow the status", () => {
    go("/admin/orders/DS-1");
    const wa = screen.getByText("WhatsApp update").closest("a").getAttribute("href");
    expect(wa.startsWith("https://wa.me/250788123456?text=")).toBe(true);
    expect(decodeURIComponent(wa)).toContain("we received your payment for DUCHI order DS-1");
    expect(screen.getByText("SMS update").closest("a").getAttribute("href").startsWith("sms:+250788123456?body=")).toBe(true);
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "Dispatched" } });
    expect(decodeURIComponent(screen.getByText("WhatsApp update").closest("a").getAttribute("href"))).toContain("has been dispatched and is on its way to Gasabo");
  });
  it("after dispatching, the toast offers to open WhatsApp with the message", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    go("/admin/orders/DS-1");
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "Dispatched" } });
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp customer" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(open.mock.calls[0][0])).toContain("https://wa.me/250788123456?text=Hello Jane, your DUCHI order DS-1 has been dispatched");
  });
});

describe("the printable receipt", () => {
  beforeEach(() => { localStorage.clear(); seed([mk("DS-1", "Delivered", { payStatus: "Paid", payRef: "AB12CD34", coupon: "WELCOME10", disc: 9300, total: 85700 })]); });

  it("shows what was bought, the totals and the payment, and prints", () => {
    asJane();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    go("/account/orders/DS-1");
    fireEvent.click(screen.getByText("Receipt"));
    const rc = screen.getByLabelText("Receipt for order DS-1");
    expect(within(rc).getByText("Receipt")).toBeTruthy(); expect(within(rc).getByText("PAID")).toBeTruthy();
    expect(within(rc).getByText("Axis Day-Date")).toBeTruthy();
    expect(rc.querySelector(".rp-sum .tot").textContent).toBe("TotalRWF 85,700");
    expect(within(rc).getByText(/Discount WELCOME10/)).toBeTruthy();
    expect(within(rc).getByText(/Reference AB12CD34/)).toBeTruthy();
    expect(document.querySelector(".top, .links")).toBeNull();                              // no shop header on a printed page
    fireEvent.click(screen.getByText("Print or save as PDF"));
    expect(print).toHaveBeenCalledTimes(1);
  });
  it("says when payment is pending or the order was cancelled, and shows a refund", () => {
    asJane();
    seed([mk("DS-1", "Processing"), mk("DS-2", "Cancelled"), mk("DS-3", "Delivered", { payStatus: "Paid", returnReq: { status: "refunded", refund: { amount: 40000, date: iso(1) } } })]);
    go("/receipt/DS-1"); expect(screen.getByText("PAYMENT PENDING")).toBeTruthy(); expect(screen.getByText("Order summary")).toBeTruthy();
    go("/receipt/DS-2"); expect(screen.getByText("CANCELLED")).toBeTruthy();
    go("/receipt/DS-3"); expect(screen.getByText("−RWF 40,000")).toBeTruthy();
  });
  it("opens only for the customer who owns the order, or for the admin", () => {
    asJane();
    seed([mk("DS-1", "Delivered", { payStatus: "Paid", email: "someone@else.rw" })]);
    go("/receipt/DS-1");
    expect(screen.queryByLabelText("Receipt for order DS-1")).toBeNull();                    // someone else's order
    localStorage.removeItem("duchi-user");
    go("/receipt/DS-1");
    expect(screen.queryByLabelText("Receipt for order DS-1")).toBeNull();                    // nobody signed in
    asAdmin();
    go("/receipt/DS-1");
    expect(screen.getByLabelText("Receipt for order DS-1")).toBeTruthy();
    expect(screen.getByText("← Back to the order").getAttribute("href")).toBe("/admin/orders/DS-1");
  });
});
