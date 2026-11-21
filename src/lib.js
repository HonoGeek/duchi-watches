// Small helpers shared across the app.
export const ls = (k, d) => {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; }
};
// Saves to the browser. Returns false (and tells the store) when the browser storage is full.
export const sv = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch {
    try { window.dispatchEvent(new Event("duchi-storage-full")); } catch { /* ignore */ }
    return false;
  }
};
export const fmt = (n) => "RWF " + Number(n).toLocaleString("en-US");
export const dt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
// "18 Nov 2026, 14:30"
export const dtm = (d) => `${dt(d)}, ${new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
export const tm = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// A photo can be an Unsplash id (demo photos), a web link, a file in /public, or an uploaded image (data URL).
export const isLocalImg = (id) => /^(https?:|data:|blob:|\/)/.test(id || "");
export const photo = (id, w = 800) =>
  !id ? "" : isLocalImg(id) ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&fm=jpg&w=${w}&q=80`;

/* ---------- admin image uploads ---------- */
// Browsers keep this data in localStorage (about 5 MB) until the backend exists, so uploads are resized
// and compressed first. Swap readImage for a real upload (S3, Cloudinary...) when the backend arrives.
export const STORAGE_LIMIT = 5_000_000; // characters, roughly what browsers allow per site
export const storageUsed = () => {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || "").length; } } catch { /* ignore */ }
  return n;
};
export const readImage = (file, max = 1200, quality = 0.8) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); // transparent PNGs get a white background
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
  img.src = url;
});

// Newest products first. Products added in Admin carry a createdAt time; the original demo products have none,
// so they are ordered by id (a higher id means it was added later).
export const byNewest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0) || b.id - a.id;

// Passwords are never stored as plain text: a salted SHA-256 hash is kept instead. (This is for the browser-only demo.
// When the backend arrives, move sign-in and password changes to the server and use bcrypt or argon2 there.)
export const newSalt = () => { try { return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""); } catch { return String(Math.random()).slice(2); } };
export const hashPw = async (salt, pw) => {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pw}:duchi-admin`));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return "plain:" + pw; } // very old browsers or http pages without crypto.subtle
};

/* ---------- form validation (one set of rules for every form) ---------- */
// An email with something before the @, a domain and an ending of at least two letters.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v) => EMAIL_RE.test(String(v ?? "").trim());
// Phone numbers: spaces, dashes and brackets are ignored. Rwanda mobile numbers (07X XXX XXX, 250 or +250 in front)
// or an international number that starts with + and a country code.
export const cleanPhone = (v) => String(v ?? "").replace(/[\s\-().]/g, "");
export const isPhone = (v) => {
  const p = cleanPhone(v);
  return /^(\+?250|0)?7[2389]\d{7}$/.test(p) || /^\+(?!250)[1-9]\d{7,14}$/.test(p);
};
// 0788 123 456, +250788123456 and 788123456 all become 0788123456 (international numbers keep their + and digits).
export const normPhone = (v) => {
  const p = cleanPhone(v);
  return /^\+(?!250)/.test(p) ? p : "0" + p.replace(/^\+?250/, "").replace(/^0/, "");
};
export const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim(); // trims and squeezes spaces: "  Jane   Doe " becomes "Jane Doe"
export const isName = (v) => { const t = clean(v); return t.length >= 2 && /\p{L}/u.test(t); }; // at least 2 characters, with a letter in it
// Whole numbers: intIn("2500", 0, 1000000) is 2500; "12.5", "-3", "" and "abc" are null.
export const intIn = (v, min = 0, max = Infinity) => {
  const s = String(v ?? "").trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};
// Card number check (Luhn): catches typing mistakes before the card goes to the payment provider.
export const isLuhn = (num) => {
  const d = String(num).replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
};
// "MM/YY" must be a real month and not already past (a card works until the end of its expiry month).
export const cardExpiryOk = (v, now = new Date()) => {
  const m = /^(\d\d)\/(\d\d)$/.exec(String(v));
  if (!m) return false;
  const mo = +m[1], yr = 2000 + +m[2];
  if (mo < 1 || mo > 12) return false;
  return yr > now.getFullYear() || (yr === now.getFullYear() && mo >= now.getMonth() + 1);
};
export const MAX_IMAGE = 15 * 1024 * 1024; // largest photo accepted for upload (it is shrunk afterwards)

// "just now", "5 min ago", "3 h ago", "2 days ago", and a date after a week
export const ago = (d, now = Date.now()) => {
  const s = Math.max(0, (now - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) { const n = Math.floor(s / 86400); return `${n} ${n === 1 ? "day" : "days"} ago`; }
  return dt(d);
};
