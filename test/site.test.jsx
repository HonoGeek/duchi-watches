import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StoreProvider, useStore } from "../src/store";
import App from "../src/App";
import { orderMessage } from "../src/pay";
import { socialUrl } from "../src/lib";

window.scrollTo = () => {};
window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
window.ResizeObserver = window.ResizeObserver || class { observe() {} disconnect() {} };
Element.prototype.scrollIntoView = () => {};
HTMLMediaElement.prototype.play = HTMLMediaElement.prototype.play || (() => Promise.resolve());
HTMLMediaElement.prototype.pause = HTMLMediaElement.prototype.pause || (() => {});

const go = (path) => { cleanup(); return render(<MemoryRouter initialEntries={[path]}><StoreProvider><App /></StoreProvider></MemoryRouter>); };
const db = (k) => JSON.parse(localStorage.getItem(k));
const asAdmin = (role = "Admin") => localStorage.setItem("duchi-adm", JSON.stringify({ email: "admin@duchistore.rw", name: "Admin", role }));
const byLabel = (root, l) => within(root).getByLabelText(typeof l === "string" ? new RegExp("^" + l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : l);
const type = (root, l, v) => fireEvent.change(byLabel(root, l), { target: { value: v } });
let S;
const Probe = () => { S = useStore(); return null; };
const boot = () => { cleanup(); render(<MemoryRouter><StoreProvider><Probe /></StoreProvider></MemoryRouter>); };
const call = (fn) => { let r; act(() => { r = fn(); }); return r; };
const BASE = { name: "DUCHI STORE", short: "DUCHI", tagline: "Quality watches.", place: "Kigali, Rwanda", email: "hello@duchistore.rw", phone: "", social: { instagram: "", tiktok: "", facebook: "", x: "" },
  hero: { headline: "Time, well kept.", text: "Find a timepiece.", type: "image", image: "", video: null, videoUrl: "" } };
const withSite = (o) => ({ ...BASE, ...o, social: { ...BASE.social, ...(o.social || {}) }, hero: { ...BASE.hero, ...(o.hero || {}) } });
afterEach(() => vi.unstubAllEnvs());

describe("social links are built and checked", () => {
  it("accepts a link or a name, and refuses links from another site", () => {
    expect(socialUrl("instagram", "@duchi_rw").url).toBe("https://instagram.com/duchi_rw");
    expect(socialUrl("tiktok", "duchi").url).toBe("https://www.tiktok.com/@duchi");
    expect(socialUrl("facebook", "https://www.facebook.com/duchistore/").url).toBe("https://www.facebook.com/duchistore/");
    expect(socialUrl("x", "http://twitter.com/duchi").url).toBe("https://twitter.com/duchi");
    expect(socialUrl("instagram", "https://facebook.com/duchi").error).toContain("does not look like an Instagram link");
    expect(socialUrl("instagram", "not a name!").error).toContain("account name");
    expect(socialUrl("instagram", "  ").url).toBe("");
  });
});

describe("Site settings: the name, contact details and social links follow everywhere", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); });

  it("starts with no fake social icons or chat button, and the shop's own name", () => {
    go("/");
    expect(document.querySelector(".logo").textContent).toBe("DUCHI.");
    expect(document.querySelector("footer .soc")).toBeNull();                          // nothing set yet: nothing shown
    expect(document.querySelector(".wa")).toBeNull();
    expect(screen.getByText(/© \d{4} DUCHI STORE, Kigali, Rwanda\./)).toBeTruthy();
  });

  it("only an Admin can open the page", () => {
    asAdmin("Manager");
    go("/admin/site");
    expect(screen.getByText("Your role does not have access to this page.")).toBeTruthy();
    expect([...document.querySelectorAll(".ax-nav a")].some((a) => a.textContent === "Site settings")).toBe(false);
  });

  it("each wrong value is refused with a reason, and nothing is saved", () => {
    boot();
    expect(call(() => S.saveSite(withSite({ name: "A" })))).toBe(false);
    expect(call(() => S.saveSite(withSite({ short: "X" })))).toBe(false);
    expect(call(() => S.saveSite(withSite({ email: "nope" })))).toBe(false);
    expect(call(() => S.saveSite(withSite({ phone: "123" })))).toBe(false);
    expect(call(() => S.saveSite(withSite({ social: { instagram: "https://tiktok.com/x" } })))).toBe(false);
    expect(S.toast.msg).toContain("Instagram");
    expect(call(() => S.saveSite(withSite({ hero: { headline: "" } })))).toBe(false);
    expect(call(() => S.saveSite(withSite({ hero: { type: "video" } })))).toBe(false);          // a video is chosen but there is none
    expect(S.toast.msg).toContain("Upload a video or paste a video link");
    expect(call(() => S.saveSite(withSite({ hero: { videoUrl: "http://x.rw/a.mp4" } })))).toBe(false);
    expect(call(() => S.saveSite(withSite({ hero: { image: "javascript:alert(1)" } })))).toBe(false);
    expect(db("duchi-site").name).toBe("DUCHI STORE");
  });

  it("changing the name on the settings page changes it on every page", () => {
    const { container } = go("/admin/site");
    const f = container.querySelector("form");
    type(f, "Store name", "Kigali Time Watches"); type(f, "Short name", "Kigali Time");
    type(f, "Short description", "Watches you can trust."); type(f, "Phone and WhatsApp number", "0788 123 456");
    type(f, "Email", "hi@kigalitime.rw"); type(f, "Where the shop is", "Kimihurura, Kigali");
    type(f, "Instagram", "@kigalitime"); type(f, "Facebook", "https://facebook.com/kigalitime");
    expect(screen.getByText("Opens https://instagram.com/kigalitime")).toBeTruthy();       // a live preview of the link
    fireEvent.submit(f);
    expect(db("duchi-site")).toMatchObject({ name: "Kigali Time Watches", short: "Kigali Time", phone: "0788 123 456", social: { instagram: "https://instagram.com/kigalitime", facebook: "https://facebook.com/kigalitime" } });

    // the admin area
    expect(document.querySelector(".ax-name").textContent).toContain("KIGALI TIME");
    expect(document.querySelector(".ax-mark").textContent).toBe("K");
    // the shop: logo, footer, title, social links, chat button
    go("/");
    expect(document.querySelector(".logo").textContent).toBe("KIGALI TIME.");
    expect(document.title).toBe("Kigali Time Watches | Kimihurura, Kigali");
    expect(screen.getByText(/Watches you can trust\./)).toBeTruthy();
    expect(screen.getByText(/The Kigali Time Difference/)).toBeTruthy();
    const soc = [...document.querySelectorAll("footer .soc a")].map((a) => [a.getAttribute("aria-label"), a.getAttribute("href")]);
    expect(soc).toEqual([["Instagram", "https://instagram.com/kigalitime"], ["Facebook", "https://facebook.com/kigalitime"], ["WhatsApp", "https://wa.me/250788123456"]]);
    expect(document.querySelector("footer .soc a").getAttribute("target")).toBe("_blank");
    expect(document.querySelector("footer .soc a").getAttribute("rel")).toContain("noopener");
    expect(document.querySelector(".wa").getAttribute("href")).toContain("https://wa.me/250788123456?text=Hello%20Kigali%20Time");
    go("/contact");
    expect(screen.getByText("hi@kigalitime.rw")).toBeTruthy(); expect(screen.getByText("Kimihurura, Kigali")).toBeTruthy(); expect(screen.getByText("0788 123 456")).toBeTruthy();
    // messages and receipts
    const o = { id: "DS-1", name: "Jane Doe", district: "Gasabo", status: "Dispatched" };
    expect(orderMessage(o, db("duchi-site"))).toContain("your Kigali Time order DS-1");
  });

  it("the customer pages and the receipt use the new name too", () => {
    localStorage.setItem("duchi-site", JSON.stringify(withSite({ name: "Kigali Time Watches", short: "Kigali Time" })));
    localStorage.setItem("duchi-user", JSON.stringify({ name: "Jane Doe", email: "jane@x.rw", phone: "0788123456" }));
    localStorage.setItem("duchi-all", JSON.stringify([{ id: "DS-1", email: "jane@x.rw", date: new Date().toISOString(), items: [{ id: 0, q: 1, p: 93000, n: "Axis", c: "Steel" }], sub: 93000, disc: 0, fee: 2000, total: 95000, pay: "Bank transfer", name: "Jane", phone: "0788123456", area: "Inside Kigali", district: "G", street: "S", status: "Delivered", payStatus: "Paid" }]));
    go("/receipt/DS-1");
    expect(screen.getByText("Kigali Time Watches")).toBeTruthy();
    expect(screen.getByText("Thank you for shopping with Kigali Time Watches.")).toBeTruthy();
    go("/account");
    expect(document.querySelector(".ax-name").textContent).toContain("KIGALI TIME");
    localStorage.removeItem("duchi-user"); localStorage.removeItem("duchi-adm");
    go("/login");
    expect(screen.getByText("Welcome to Kigali Time")).toBeTruthy();
    go("/admin");
    expect(screen.getByText(/Sign in to the Kigali Time admin area/)).toBeTruthy();
  });
});

describe("Site settings: the home page hero", () => {
  beforeEach(() => { localStorage.clear(); asAdmin(); });
  const hero = () => document.querySelector(".hx");

  it("the headline and text come from the settings, and a photo link replaces the picture", () => {
    localStorage.setItem("duchi-site", JSON.stringify(withSite({ hero: { headline: "Every second counts", text: "Our new season is here.", image: "https://cdn.example.com/hero.jpg" } })));
    go("/");
    expect(hero().querySelector(".hx-sr").textContent).toBe("Every second counts");
    expect([...hero().querySelectorAll(".hx-line")].map((l) => l.textContent)).toEqual(["Every second", "counts"]);
    expect(hero().querySelector(".hx-lead").textContent).toBe("Our new season is here.");
    expect(hero().querySelector(".hx-ph img").getAttribute("src")).toBe("https://cdn.example.com/hero.jpg");
    expect(hero().querySelector("video")).toBeNull();
  });

  it("with a video, it plays muted and looping over the still picture", () => {
    localStorage.setItem("duchi-site", JSON.stringify(withSite({ hero: { type: "video", videoUrl: "https://cdn.example.com/hero.mp4", image: "https://cdn.example.com/still.jpg" } })));
    go("/");
    const v = hero().querySelector(".hx-ph video");
    expect(v.getAttribute("src")).toBe("https://cdn.example.com/hero.mp4");
    expect(v.muted).toBe(true); expect(v.loop).toBe(true); expect(v.autoplay).toBe(true);
    expect(v.getAttribute("poster")).toBe("https://cdn.example.com/still.jpg");
    expect(hero().querySelector(".hx-ph img").getAttribute("src")).toBe("https://cdn.example.com/still.jpg");
    fireEvent.error(v);                                                                 // a video that fails leaves the picture
    expect(hero().querySelector("video")).toBeNull();
    expect(hero().querySelector(".hx-ph img")).toBeTruthy();
  });

  it("people who prefer less motion get the still picture, not the video", () => {
    const real = window.matchMedia;
    window.matchMedia = (q) => ({ matches: /prefers-reduced-motion/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
    localStorage.setItem("duchi-site", JSON.stringify(withSite({ hero: { type: "video", videoUrl: "https://cdn.example.com/hero.mp4" } })));
    go("/");
    expect(hero().querySelector("video")).toBeNull();
    window.matchMedia = real;
  });

  it("the settings page switches between image and video, and keeps the choice", () => {
    const { container } = go("/admin/site");
    const f = container.querySelector("form");
    fireEvent.click(within(f).getByRole("button", { name: "Video" }));
    expect(within(f).getByLabelText("Upload a hero video")).toBeTruthy();
    fireEvent.submit(f);                                                                 // video chosen, but none given: refused
    expect(db("duchi-site").hero.type).toBe("image");
    type(f, "Or paste a video link", "https://cdn.example.com/hero.mp4");
    fireEvent.submit(f);
    expect(db("duchi-site").hero).toMatchObject({ type: "video", videoUrl: "https://cdn.example.com/hero.mp4" });
    fireEvent.click(within(f).getByRole("button", { name: "Image" }));
    type(f, "Or paste a photo link", "https://cdn.example.com/photo.jpg");
    fireEvent.submit(f);
    expect(db("duchi-site").hero).toMatchObject({ type: "image", image: "https://cdn.example.com/photo.jpg" });
    fireEvent.click(within(f).getByText("Use the default photo"));
    fireEvent.submit(f);
    expect(db("duchi-site").hero.image).toBe("");
  });

  it("a file that is not a photo or a video is refused with a message", () => {
    const { container } = go("/admin/site");
    const f = container.querySelector("form");
    const input = within(f).getByLabelText("Upload a hero photo");
    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(document.querySelector(".toast").textContent).toContain("Please choose an image file");
    fireEvent.click(within(f).getByRole("button", { name: "Video" }));
    fireEvent.change(within(f).getByLabelText("Upload a hero video"), { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });
    expect(document.querySelector(".toast").textContent).toContain("Please choose a video file");
  });
});
