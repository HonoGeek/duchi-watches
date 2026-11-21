import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "./store";
import { Img, Button, Heart, Icon, Qty } from "./ui";
import { fmt } from "./lib";

/* New arrivals: a turntable. The watches stand on a round platform and the whole ring rotates in 3D.
   The front one faces you, the ones behind are smaller and darker. "Explore piece" slides the front
   watch to the left and opens a glass product card. */
const TILT = 10;      // degrees the ring is tipped toward the viewer
const PERSP = 1100;   // px of perspective on the stage
const AUTO_MS = 4500; // autoplay delay
const BLUR_MIN = 1.8;  // px of blur on the watches right beside the front one
const BLUR_RANGE = 3.6; // extra px added for the ones at the back

export default function HangingRail({ items }) {
  const { addToCart, showToast, zones } = useStore();
  const stageRef = useRef(null);
  const touchX = useRef(null);
  const [W, setW] = useState(1000);
  const [turn, setTurn] = useState(0);          // how many steps the ring has turned (unbounded, so it never spins back)
  const [open, setOpen] = useState(false);
  const [ph, setPh] = useState(0);
  const [qty, setQty] = useState(1);
  const [sw, setSw] = useState(0);              // restarts the lift-and-settle animation
  const [auto, setAuto] = useState(true);       // the visitor's play/pause button
  const [hold, setHold] = useState(false);      // mouse over / keyboard focus
  const [inView, setInView] = useState(true);   // rail visible on screen
  const [tick, setTick] = useState(0);
  const n = items.length;
  const step = 360 / n;
  const active = ((turn % n) + n) % n;
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => setW(el.clientWidth || 1000);
    read();
    if (typeof ResizeObserver === "undefined") { addEventListener("resize", read); return () => removeEventListener("resize", read); }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const rotate = (delta) => {
    if (!delta) return;
    setTurn((t) => t + delta); setSw((s) => s + 1); setPh(0); setQty(1);
  };
  const next = () => rotate(1);
  const prev = () => rotate(-1);
  const pick = (i) => {
    const rel = (((i - active) % n) + n) % n;
    rotate(rel > n / 2 ? rel - n : rel); // shortest way round
  };

  // Autoplay: loops forever. Pauses while hovering, focusing, exploring, off-screen or in a hidden tab.
  const playing = auto && !hold && inView && !open && !reduce && n > 1;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (document.hidden) { setTick((k) => k + 1); return; }
      rotate(1);
    }, AUTO_MS);
    return () => clearTimeout(t);
  }, [playing, turn, tick]);

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const r = stageRef.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > innerHeight) return; // only react while the ring is on screen
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape" && open) setOpen(false);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  // ---- geometry (px, derived from container width)
  const mobile = W < 760;
  const aw = mobile ? Math.min(200, W * 0.46) : Math.min(260, W * 0.24);
  const R = aw * (mobile ? 1 : 1.25);                       // ring radius (tighter on phones so the side watches stay on screen)
  const shift = R * Math.sin((TILT * Math.PI) / 180);    // how far the tilt drops the front card
  const bottom = open ? 150 : 104;                       // space under the front card for the platform, thumbnails and dots
  const s = open ? (mobile ? 0.82 : 1.12) : 1;           // front card scale
  const contentH = s * (shift + aw * 0.4925) + aw / 2 + 36;
  const stageH = Math.max(contentH + bottom, open && !mobile ? 590 : 0);
  const baseY = stageH - bottom;                         // where the front card's bottom edge sits
  const ringTop = baseY - s * (shift + aw * 0.4925) - aw / 2;
  const activeX = open ? (mobile ? 0 : -W * 0.2) : 0;
  const discW = (R + aw * 0.42) * 2;
  const discH = 2 * shift + 40;
  const p = items[active];

  const add = () => {
    if (addToCart(p.id, qty)) { setQty(1); showToast(`${p.n} added to cart`, { to: "/cart", label: "View cart" }); }
  };
  const zoneText = zones.map((z) => `${z.name} ${fmt(z.fee)}`).join(", ");

  return (
    <div className={`rl${open ? " open" : ""}${mobile ? " mob" : ""}`}>
      <div
        className="rl-stage" ref={stageRef} style={{ height: stageH, perspective: PERSP, perspectiveOrigin: `${W / 2 + activeX}px 40%` }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setHold(false)}
        onFocus={(e) => e.target.matches?.(":focus-visible") && setHold(true)}
        onBlur={() => setHold(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const d = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(d) > 45) (d < 0 ? next : prev)();
        }}
      >
        <span className="rl-spot" aria-hidden="true" style={{ width: aw * 2.8, marginLeft: -aw * 1.4, height: baseY + 60, "--x": `${activeX}px` }} />
        <span className="rl-disc" aria-hidden="true" style={{ width: discW, height: discH, marginLeft: -discW / 2, top: baseY + 16 - discH }} />

        <div className="rl-ring" style={{ top: ringTop, height: aw, transform: `translate3d(${activeX}px,0,${-R}px) rotateX(${-TILT}deg) scale(${s})` }}>
          {items.map((it, i) => {
            const th = (i - turn) * step;
            const rel = (((i - turn) % n) + n) % n;
            const d = rel > n / 2 ? rel - n : rel;
            const rad = (th * Math.PI) / 180;
            const c = Math.cos(rad), sn = Math.sin(rad);
            const front = d === 0;
            const hidden = open && !front;
            const bright = open ? 1 : 0.4 + 0.6 * ((1 + c) / 2);
            const blur = open || front ? 0 : BLUR_MIN + BLUR_RANGE * ((1 - c) / 2); // the further round the ring, the softer
            return (
              <button
                key={it.id} type="button" className={`rl-it${front ? " on" : ""}`}
                aria-label={front && !open ? `${it.n}. Explore piece` : it.n} tabIndex={hidden || Math.abs(d) > 1 ? -1 : 0} aria-hidden={hidden || undefined}
                onClick={() => (front ? setOpen(true) : pick(i))}
                style={{ width: aw, height: aw, marginLeft: -aw / 2, pointerEvents: hidden ? "none" : "auto", transform: `rotateY(${th}deg) translateZ(${R}px)` }}
              >
                <span className="rl-bb" style={{ transform: `rotateY(${-th - 38 * sn}deg)`, filter: `brightness(${bright}) blur(${blur.toFixed(2)}px)`, opacity: hidden ? 0 : 1 }}>
                  <span className={`rl-sh${sw ? ` s${sw % 2}` : ""}`} aria-hidden="true" />
                  <span className={`rl-sw${sw ? ` s${sw % 2}` : ""}`} style={{ "--l": `${front ? 16 : 6}px` }}>
                    <span className="rl-pic"><Img key={front ? it.im[ph] : it.im[0]} id={front ? it.im[ph] || it.im[0] : it.im[0]} alt={front ? it.n : ""} w={700} /></span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" className="rl-ar l" aria-label="Previous watch" onClick={prev}>{Icon.left}</button>
        <button type="button" className="rl-ar r" aria-label="Next watch" onClick={next}>{Icon.right}</button>
        <div className="rl-dots" aria-hidden="true">
          {items.map((_, i) => <i key={i === active ? `a${turn}` : i} className={i === active ? `on${playing ? " run" : ""}` : ""} style={{ "--ms": `${AUTO_MS}ms` }} />)}
        </div>
        {open && (
          <div className="rl-thumbs" role="group" aria-label={`Other photos of ${p.n}`} style={{ top: baseY + 46, "--x": `${activeX}px` }}>
            {p.im.map((m, k) => (k === ph ? null : (
              <button key={k} type="button" onClick={() => setPh(k)} aria-label={`Show photo ${k + 1}`}><Img id={m} w={160} /></button>
            )))}
          </div>
        )}
        {!reduce && n > 1 && (
          <button type="button" className="rl-pp" aria-label={auto ? "Pause autoplay" : "Play autoplay"} aria-pressed={!auto} onClick={() => setAuto((v) => !v)}>
            {auto
              ? <svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              : <svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>}
          </button>
        )}
      </div>

      {!open && (
        <div className="rl-cap" key={p.id} aria-live="polite">
          <h3>{p.n}</h3>
          <div className="mute sm">{p.s} · {p.c}</div>
          <div className="price" style={{ margin: "4px 0 14px" }}>{fmt(p.p)}</div>
          <Button variant="o" size="s" onClick={() => setOpen(true)}>Explore piece</Button>
        </div>
      )}

      {open && (
        <aside className="rl-panel" key={p.id} aria-label={p.n}>
          <button type="button" className="rl-x" aria-label="Close" onClick={() => setOpen(false)}>{Icon.cross}</button>
          <div className="rl-k">
            {p.stock <= 0 ? "SOLD OUT" : p.tag ? p.tag.toUpperCase() : "NEW ARRIVAL"} · {active + 1}/{n}
          </div>
          <h3 className="rl-t">{p.n}</h3>
          <div className="rl-pr">{fmt(p.p)} <span className="mute sm">Delivery added at checkout</span></div>

          <div className="rl-l">Quantity</div>
          <Qty value={qty} max={p.stock} onMinus={() => setQty(Math.max(1, qty - 1))} onPlus={() => setQty(Math.min(qty + 1, Math.max(1, p.stock)))} />

          <div className="rl-ct">
            {p.stock <= 0 ? <Button variant="o" disabled style={{ flex: 1 }}>Sold out</Button>
              : <Button variant="g" onClick={add} style={{ flex: 1 }}>Add to bag · {fmt(p.p * qty)}</Button>}
            <Heart id={p.id} page />
          </div>
          <Link className="rl-full" to={`/product/${p.id}`}>Full details</Link>

          <details className="rl-d"><summary>Details</summary><p>{p.s}. {p.c} watch, checked by our team in Kigali before dispatch.</p></details>
          <details className="rl-d"><summary>Delivery</summary><p>One flat fee per order: {zoneText}.</p></details>
          <details className="rl-d"><summary>What is in the box</summary><p>The watch and a gift-ready box.</p></details>
        </aside>
      )}
    </div>
  );
}
