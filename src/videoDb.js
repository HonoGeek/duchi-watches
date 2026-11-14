import { useEffect, useState } from "react";

/* Showcase videos uploaded in Admin > Videos.
   Video files are far too big for localStorage, so they are kept in the browser's IndexedDB (hundreds of MB).
   The video list in the store only keeps a small record for each video: { id, name, size, poster, duration, ... }.
   Like the rest of the demo data, this lives in this browser only. When the backend arrives, upload the file to
   your server (S3, Cloudinary...) in Admin > Videos and keep the returned link in the same record. */

export const MAX_VIDEO = 150 * 1024 * 1024; // 150 MB per video

const open = () => new Promise((resolve, reject) => {
  if (typeof indexedDB === "undefined") { reject(Object.assign(new Error("no indexedDB"), { code: "unsupported" })); return; }
  const r = indexedDB.open("duchi-media", 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("videos")) r.result.createObjectStore("videos"); };
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(Object.assign(r.error || new Error("open failed"), { code: "unsupported" }));
});

const run = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("videos", mode);
    let out;
    try { out = fn(tx.objectStore("videos")); } catch (e) { reject(e); return; }
    tx.oncomplete = () => { db.close(); resolve(out && "result" in out ? out.result : out); };
    tx.onabort = tx.onerror = () => {
      db.close();
      const err = tx.error || new Error("storage failed");
      reject(Object.assign(err, { code: err.name === "QuotaExceededError" ? "quota" : "storage" }));
    };
  });
};

export const putVideo = (id, blob) => run("readwrite", (s) => { s.put(blob, id); });
export const getVideo = (id) => run("readonly", (s) => s.get(id));
export const deleteVideo = (id) => run("readwrite", (s) => { s.delete(id); });

/* Reads the video in the browser: checks it can be played and grabs a cover picture from its first seconds. */
export const probeVideo = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto"; v.muted = true; v.playsInline = true;
  const finish = (fn, arg) => { clearTimeout(timer); v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url); fn(arg); };
  const timer = setTimeout(() => finish(reject, Object.assign(new Error("timeout"), { code: "unreadable" })), 20000);
  v.onerror = () => finish(reject, Object.assign(new Error("unreadable"), { code: "unreadable" }));
  v.onloadedmetadata = () => {
    const d = v.duration || 0;
    try { v.currentTime = d > 1 ? Math.min(1, d / 4) : 0; } catch { /* some browsers need a frame first */ }
  };
  v.onseeked = () => {
    try {
      const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k));
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      finish(resolve, { poster: c.toDataURL("image/jpeg", 0.78), duration: v.duration || 0, w: v.videoWidth, h: v.videoHeight });
    } catch (e) { finish(reject, Object.assign(e, { code: "unreadable" })); }
  };
  v.src = url;
});

/* Gives a playable address for a stored video, and frees it again when it is no longer needed. */
export function useVideoUrl(id) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true, made = "";
    setUrl("");
    if (!id) return undefined;
    getVideo(id).then((blob) => {
      if (!alive || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [id]);
  return url;
}

export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
