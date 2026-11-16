import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "./store";
import { Img, Reveal } from "./ui";
import { useVideoUrl } from "./videoDb";

// "More Than Just a Watch": 4 videos in one row. Tap a card to play it in a modal.
// Upload the videos in Admin > Videos. On phones the row scrolls sideways so it stays one row.
const mmss = (n) => {
  if (!Number.isFinite(n) || n <= 0) return "";
  const t = Math.round(n);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

// Modal player: click the backdrop, press Escape or use the close button to leave. Page scroll is locked while open.
function Lightbox({ src, poster, title, onClose, onBad }) {
  const closeRef = useRef(null);
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") cb.current(); };
    const prev = document.body.style.overflow;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="vmod" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="vmod-in" onClick={(e) => e.stopPropagation()}>
        <video src={src} poster={poster} controls autoPlay playsInline onError={onBad} />
        <div className="vmod-cap">{title}</div>
      </div>
      <button ref={closeRef} type="button" className="vmod-x" onClick={onClose} aria-label="Close video">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>,
    document.body
  );
}

function Clip({ v }) {
  const [open, setOpen] = useState(false);
  const [bad, setBad] = useState(false);
  const [dur, setDur] = useState(0);
  const btn = useRef(null);
  const stored = useVideoUrl(v.file?.id);   // an uploaded file, read from this browser
  const src = stored || v.src || "";        // or an older video link
  const waiting = !!v.file && !stored;      // the uploaded file is still being read
  const has = !!src;
  const poster = v.file?.poster || v.poster;
  const time = typeof v.duration === "string" ? v.duration : mmss(v.duration || dur); // v.duration (seconds or "0:42") wins over the measured length
  const close = () => { setOpen(false); btn.current?.focus(); };
  return (
    <div className="vc">
      <div className="vph">
        <button ref={btn} type="button" className="vbtn" onClick={() => { if (has) { setBad(false); setOpen(true); } }} disabled={!has}
          aria-haspopup="dialog" aria-label={has ? `Play video: ${v.title}` : `${v.title} (video coming soon)`}>
          <Img id={poster} alt="" w={600} />
          <span className="vplay" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg></span>
          {time && <span className="vdur">{time}</span>}
          {!has && !waiting && <span className="vsoon">Coming soon</span>}
          {bad && <span className="vsoon">This video could not be played</span>}
        </button>
      </div>
      <div className="vt">{v.title}</div>
      {has && !v.duration && <video src={src} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true"
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} />}
      {open && has && <Lightbox src={src} poster={poster} title={v.title} onClose={close} onBad={() => { setOpen(false); setBad(true); }} />}
    </div>
  );
}

export default function Videos() {
  const { videos } = useStore();
  const list = videos.slice(0, 4);
  return (
    <section className="alt"><div className="wrap">
      <Reveal className="head"><div className="sh"><h2 className="h2">More Than Just a Watch</h2><p className="sub">A closer look at the details that make every timepiece special. Explore the craftsmanship, finishing, movement, and versatility of our watches through real-life moments.</p></div></Reveal>
      <div className="vrow">
        {list.map((v, i) => <Reveal key={i} d={i * 90} className="vcw"><Clip v={v} /></Reveal>)}
      </div>
    </div></section>
  );
}
