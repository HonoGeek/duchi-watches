import { useState } from "react";
import { useStore } from "./store";
import { Img, Reveal } from "./ui";
import { useVideoUrl } from "./videoDb";

// "More Than Just a Watch": 4 videos in one row. Tap a card to play it in place.
// Upload the videos in Admin > Videos. On phones the row scrolls sideways so it stays one row.
function Clip({ v }) {
  const [play, setPlay] = useState(false);
  const [bad, setBad] = useState(false);
  const stored = useVideoUrl(v.file?.id);   // an uploaded file, read from this browser
  const src = stored || v.src || "";        // or an older video link
  const waiting = !!v.file && !stored;      // the uploaded file is still being read
  const has = !!src;
  const poster = v.file?.poster || v.poster;
  return (
    <div className="vc">
      <div className="vph">
        {play && has
          ? <video src={src} poster={poster} controls autoPlay playsInline preload="metadata" onEnded={() => setPlay(false)}
              onError={() => { setPlay(false); setBad(true); }} />
          : (
            <button type="button" className="vbtn" onClick={() => { if (has) { setBad(false); setPlay(true); } }} disabled={!has}
              aria-label={has ? `Play video: ${v.title}` : `${v.title} (video coming soon)`}>
              <Img id={poster} alt="" w={600} />
              <span className="vplay" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg></span>
              {!has && !waiting && <span className="vsoon">Coming soon</span>}
              {bad && <span className="vsoon">This video could not be played</span>}
            </button>
          )}
      </div>
      <div className="vt">{v.title}</div>
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
