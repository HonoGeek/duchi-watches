// Sample data. When the backend exists, these seeds are replaced by API calls.
export const IM = [
  "1735352246756-1abb2a4ba09c",
  "1727716919539-3cd4aaf7af99",
  "1494450157324-90244222d5eb",
  "1623998021450-85c29c644e0d",
  "1667375565651-b660b574d1a9",
];

const N = [
  ["Axis Day-Date", "Teal dial", "Steel", 95000],
  ["Icon Diver", "Black dial", "Steel", 105000],
  ["Ignite Chronograph", "Black cherry dial", "Chronograph", 140000],
  ["Montclair Tank", "Roman dial", "Leather", 105000],
  ["Voyager Chronograph", "Deep blue dial", "Chronograph", 150000],
  ["Pioneer Calendar", "Oud dial", "Leather", 105000],
  ["Summit Two-Tone", "Pearl gold dial", "Chronograph", 140000],
  ["Legacy Date", "Noir dial", "Steel", 130000],
];
const STOCK = [12, 8, 6, 10, 5, 9, 7, 4];

export const SEED_PRODUCTS = N.map((x, i) => ({
  id: i, n: x[0], s: x[1], c: x[2], p: x[3],
  im: [0, 1, 2, 3].map((k) => IM[(i + k) % IM.length]),
  tag: i === 0 ? "New" : i === 2 ? "Popular" : "",
  stock: STOCK[i], active: true,
  // Product details shown on the product page: a description, short highlight lines and what is in the box.
  desc: `A dependable everyday watch with a ${x[1].toLowerCase()} and a comfortable fit.`,
  highlights: ["Checked by our team before dispatch", "Gift-ready box included"],
  box: "Watch, gift box",
  // Specification rows shown on the product page (only filled rows are shown).
  spec: { movement: "Quartz", caseSize: "", water: "", strap: "", glass: "" },
}));

// Labels for the specification fields (used by the admin form and the product page).
export const SPEC_FIELDS = [
  ["movement", "Movement", "e.g. Quartz, Automatic"],
  ["caseSize", "Case size", "e.g. 40 mm"],
  ["water", "Water resistance", "e.g. 3 ATM"],
  ["strap", "Strap or bracelet", "e.g. Stainless steel"],
  ["glass", "Glass", "e.g. Mineral, Sapphire"],
];

// Product form limits and suggestions.
export const MAX_PHOTOS = 10;
export const DESC_MAX = 800;
export const MAX_HIGHLIGHTS = 6;
export const BADGES = ["New", "Popular", "Limited", "Sale", "Last pieces"];

// "Showing off our watches" videos: 4 slots shown in one row. Edit in Admin > Videos.
// src is a video file link (.mp4) or a file in /public; poster is the cover image (photo id or link).
export const SEED_VIDEOS = [
  { title: "On the wrist", src: "", poster: IM[2] },
  { title: "Dial close-up", src: "", poster: IM[1] },
  { title: "Unboxing", src: "", poster: IM[3] },
  { title: "Strap and fit", src: "", poster: IM[4] },
];

// Sizes for the shop filter.
export const PRICE_BANDS = [["Any price", 0, Infinity], ["Under RWF 100,000", 0, 100000], ["RWF 100,000 to 130,000", 100000, 130000], ["Over RWF 130,000", 130000, Infinity]];

export const SEED_ZONES = [
  { name: "Inside Kigali", fee: 2000 },
  { name: "Outside Kigali", fee: 3000 },
];
export const SEED_COUPONS = [{ code: "WELCOME10", type: "pct", val: 10, active: true }];
export const SEED_STAFF = [
  { name: "Admin", email: "admin@duchistore.rw", role: "Admin", active: true },
  { name: "Manager", email: "manager@duchistore.rw", role: "Manager", active: true },
  { name: "Staff", email: "staff@duchistore.rw", role: "Staff", active: true },
];

export const CATS = ["Steel", "Leather", "Chronograph"];
// Categories are managed in Admin > Categories. img is the cover photo shown on the Home page tile (optional).
export const SEED_CATS = [{ name: "Steel", img: IM[1] }, { name: "Leather", img: IM[4] }, { name: "Chronograph", img: IM[0] }];
export const ST = ["Processing", "Dispatched", "Delivered", "Cancelled"];
export const PAYS = ["MTN Mobile Money", "Airtel Money", "Card", "Bank transfer"];
export const DEMO_ADMIN_PASSWORD = "admin123";
export const PAY_STATUS = ["Pending", "Paid", "Failed"];
// Mobile-money merchant codes. Confirm the exact USSD strings with MTN / Airtel and edit them in Admin > Payments.
export const SEED_PAYCFG = {
  mtn: { code: "000000", tpl: "*182*8*1*{code}#" },
  airtel: { code: "000000", tpl: "*500#" },
};
export const PERM = {
  Admin: ["", "orders", "products", "categories", "reviews", "videos", "coupons", "shipping", "payments", "team", "audit", "settings"],
  Manager: ["", "orders", "products", "categories", "reviews", "videos", "coupons", "shipping", "audit", "settings"],
  Staff: ["", "orders", "products", "settings"],
};

// SAMPLE reviews for the design preview (marked "Sample" in Admin > Reviews, so you can delete them before launch).
// Real reviews are written by customers after their order is delivered. pid is the product id, ago is how many days ago.
export const REVIEWS = [
  { pid: 0, n: "Aline M.", r: 5, t: "Packaging was lovely and delivery in Kigali was quick. The watch looks even better in person.", ago: 21 },
  { pid: 4, n: "Eric N.", r: 5, t: "Paid with MoMo and it was smooth. The strap fitted perfectly.", img: IM[4], ago: 17 },
  { pid: 3, n: "Grace U.", r: 4, t: "Great value for the price. The gift box made it an easy birthday present.", img: IM[3], ago: 12 },
  { pid: 2, n: "Patrick H.", r: 5, t: "They answered all my questions on WhatsApp the same day.", ago: 9 },
  { pid: 7, n: "Diane K.", r: 5, t: "Clean dial and a solid feel on the wrist. I will order again.", ago: 6 },
  { pid: 5, n: "Jean Claude B.", r: 5, t: "Delivered outside Kigali in two days, exactly as pictured.", ago: 3 },
];

// Review rules. Only customers whose order is "Delivered" can review that product (one review per product per order).
export const REVIEWS_NEED_APPROVAL = false; // true: new reviews wait in Admin > Reviews until you publish them
export const REVIEW_MIN = 10;               // shortest review text
export const REVIEW_MAX = 600;              // longest review text
export const SEED_REVIEWS = REVIEWS.map((r, i) => ({
  id: "s" + i, key: "seed" + i, pid: r.pid, email: "", n: r.n, r: r.r, t: r.t, img: r.img || "",
  date: new Date(Date.now() - r.ago * 864e5).toISOString(), verified: true, status: "published", sample: true,
}));
