import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Img } from "./ui";
import { IM } from "./data";
import { fmt } from "./lib";
import heroImg from "./images/hero.jpg";
import "./hero.css";

/* ---- Hero photograph --------------------------------------------------------
   Uses src/images/hero.jpg. HERO_POS decides which part of the photo stays
   visible when the screen is narrower or shorter than the photo:
   "50% 60%" = centred, slightly low. Raise the second number to show more of
   the bottom of the photo, lower it to show more of the top.
   If the photo fails to load, the original site image (IM[2]) is used.        */
const HERO_IMG = heroImg;
const HERO_POS = "50% 60%";

const mq = (q) => typeof window !== "undefined" && window.matchMedia(q).matches;
const prefersReduced = () => mq("(prefers-reduced-motion: reduce)");

const Arrow = () => (
  <svg className="hx-arrow" viewBox="0 0 34 10" aria-hidden="true"><path d="M0 5h33M28.5 1 33 5l-4.5 4" /></svg>
);

export default function Hero({ minFee }) {
  const root = useRef(null);
  const plate = useRef(null);
  const ph = useRef(null);
  const copy = useRef(null);
  const body = useRef(null);
  const [imgOk, setImgOk] = useState(true);
  // The sequence starts once the photograph AND the display font are ready, so the reveal
  // never plays on an empty frame and the headline never swaps fonts while it is rising.
  const [ready, setReady] = useState(prefersReduced);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    const go = () => alive && setReady(true);
    const ceiling = setTimeout(go, 2200); // slow networks never hold the page back

    const fonts = document.fonts?.ready ?? Promise.resolve();
    const img = root.current?.querySelector(".hx-ph img");
    const photo = new Promise((res) => {
      if (!img || img.complete) return res();
      img.addEventListener("load", res, { once: true });
      img.addEventListener("error", res, { once: true });
    });
    Promise.all([fonts, photo]).then(go);

    return () => { alive = false; clearTimeout(ceiling); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!imgOk) setReady(true); }, [imgOk]);

  // Pointer parallax (fine pointers only) + scroll dissolve.
  // Transforms are written straight to refs: no React re-renders, one rAF per change,
  // and the scroll listener only exists while the hero is on screen.
  useEffect(() => {
    const el = root.current;
    if (!el || prefersReduced()) return;
    const fine = mq("(hover: hover) and (pointer: fine)");
    const D = fine ? { drift: 60, zoom: 0.05, lift: -34 } : { drift: 30, zoom: 0.03, lift: -22 };
    const s = { tx: 0, ty: 0, x: 0, y: 0, p: -1, raf: 0 };

    const write = () => {
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / r.height));
      if (p !== s.p) {
        s.p = p;
        // the watch lags behind the page and dims into it; the copy lifts away faster
        plate.current.style.transform = `translate3d(0,${(p * D.drift).toFixed(1)}px,0) scale(${(1 + p * D.zoom).toFixed(4)})`;
        plate.current.style.opacity = (1 - p * 0.55).toFixed(3);
        body.current.style.transform = `translate3d(0,${(p * D.lift).toFixed(1)}px,0)`;
        body.current.style.opacity = (1 - Math.min(1, p * 1.5)).toFixed(3);
      }
      if (fine) {
        // the watch leads, the headline answers a hair the other way
        ph.current.style.transform = `translate3d(${(s.x * -10).toFixed(2)}px,${(s.y * -6).toFixed(2)}px,0)`;
        copy.current.style.transform = `translate3d(${(s.x * 3.5).toFixed(2)}px,${(s.y * 2).toFixed(2)}px,0)`;
      }
    };
    const frame = () => {
      s.raf = 0;
      s.x += (s.tx - s.x) * 0.06;
      s.y += (s.ty - s.y) * 0.06;
      write();
      if (Math.abs(s.tx - s.x) > 0.001 || Math.abs(s.ty - s.y) > 0.001) s.raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!s.raf) s.raf = requestAnimationFrame(frame); };
    const move = (e) => {
      if (e.pointerType !== "mouse") return;
      s.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      s.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      kick();
    };
    const leave = () => { s.tx = 0; s.ty = 0; kick(); };

    let listening = false;
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !listening) {
        listening = true;
        window.addEventListener("scroll", kick, { passive: true });
        window.addEventListener("resize", kick);
        kick();
      } else if (!en.isIntersecting && listening) {
        listening = false;
        window.removeEventListener("scroll", kick);
        window.removeEventListener("resize", kick);
      }
    });
    io.observe(el);
    if (fine) {
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
    }
    return () => {
      io.disconnect();
      cancelAnimationFrame(s.raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  // A plain, one-time smooth scroll to whatever section follows the hero. No scroll hijacking.
  const toNext = () =>
    root.current?.nextElementSibling?.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });

  return (
    <section className={`hx${ready ? " is-in" : ""}`} ref={root} aria-label="Featured collection">
      {/* photograph (decorative) */}
      <div className="hx-plate" ref={plate} aria-hidden="true" style={{ "--hx-pos": HERO_POS }}>
        <div className="hx-ph" ref={ph}>
          {imgOk ? (
            <img src={HERO_IMG} alt="" fetchPriority="high" decoding="async" onError={() => setImgOk(false)} />
          ) : (
            <Img id={IM[2]} alt="" w={2000} />
          )}
        </div>
        <div className="hx-glint" />
      </div>
      <div className="hx-shade" />
      <div className="hx-grain" />
      <div className="hx-veil" />

      <div className="wrap hx-in" ref={body}>
        <div className="hx-copy" ref={copy}>
          {/* real text for assistive tech; the split lines below are the visual version */}
          <h1 className="hx-h1">
            <span className="hx-sr">Time, well kept.</span>
            <span className="hx-line" aria-hidden="true"><span style={{ "--i": 0 }}>Time,</span></span>
            <span className="hx-line hx-em" aria-hidden="true"><span style={{ "--i": 1 }}>well kept.</span></span>
          </h1>

          <p className="hx-lead hx-r">Discover watches that bring together timeless design, everyday comfort, and effortless style. Whether you're dressing for a special occasion or making every day count, find a timepiece that speaks to you.</p>

          <div className="hx-cta hx-r">
            <Link className="hx-btn hx-pri" to="/shop"><span>Explore the collection</span><Arrow /></Link>
            <Link className="hx-btn hx-sec" to="/contact">Talk to us</Link>
          </div>
        </div>

        <div className="hx-bar hx-r">
          <div className="hx-facts">
            <div><b>Delivered across Rwanda</b><span>From {fmt(minFee)}</span></div>
            <div><b>Pay your way</b><span>MTN MoMo, Airtel Money, card</span></div>
            <div><b>Checked before dispatch</b><span>Every watch, every order</span></div>
          </div>
          <button type="button" className="hx-scroll" onClick={toNext}>
            <span>Scroll</span><i aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
