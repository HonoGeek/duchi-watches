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
