import { useRef } from "react";
import { Link } from "react-router-dom";
import { Img, Reveal, Icon, Stars } from "./ui";
import { useStore } from "./store";

// Home page carousel: the latest published reviews from real (and sample) customers.
export default function Reviews({ alt = true }) {
  const { published, products } = useStore();
  const ref = useRef(null);
  const list = [...published].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);
  if (!list.length) return null;
  const avg = published.reduce((a, r) => a + r.r, 0) / published.length;
  const go = (d) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className={alt ? "alt" : ""}>
      <div className="wrap">
        <Reveal className="head" style={{ alignItems: "center" }}>
          <div>
            <h2 className="h2">Customer reviews</h2>
            <div className="row" style={{ marginTop: 10 }}>
              <Stars n={Math.round(avg)} />
              <span className="mute sm">{avg.toFixed(1)} from {published.length} reviews</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="ib arr" onClick={() => go(-1)} aria-label="Previous reviews">{Icon.left}</button>
            <button className="ib arr" onClick={() => go(1)} aria-label="Next reviews">{Icon.right}</button>
          </div>
        </Reveal>
        <div className="rvw" ref={ref}>
          {list.map((r, i) => (
            <Reveal key={r.id} d={i * 90} className="rcw">
              <article className="rc">
                <Stars n={r.r} />
                <p>“{r.t}”</p>
                {r.img && <div className="rimg"><Img id={r.img} alt={`Photo from ${r.n}`} w={500} /></div>}
                <div className="rby">
                  <div className="av">{r.n[0]}</div>
                  <div><b style={{ fontWeight: 500 }}>{r.n}</b><div className="mute sm"><Link to={`/product/${r.pid}`}>{products[r.pid]?.n}</Link>{r.verified ? " · Verified buyer" : ""}</div></div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
