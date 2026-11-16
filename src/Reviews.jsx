import { Link } from "react-router-dom";
import { Img, Reveal, Icon, Stars, Button, useCarousel } from "./ui";
import { useStore } from "./store";
import { dt } from "./lib";

// Only reviews written by customers through the store (they carry the order they came from) are shown on the home page.
// Sample or test entries without an order are never displayed.
const isReal = (r) => !!r && !!r.orderId && typeof r.t === "string" && r.t.trim().length > 0;

// Home page carousel: the latest published reviews from real customers.
export default function Reviews({ alt = true }) {
  const { published, products } = useStore();
  const real = published.filter(isReal);
  const list = [...real].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);
  const { ref, go, canPrev, canNext, onKeyDown } = useCarousel(list.length);
  const avg = real.length ? real.reduce((a, r) => a + r.r, 0) / real.length : 0;

  return (
    <section className={alt ? "alt" : ""}>
      <div className="wrap">
        <Reveal className="head" style={{ alignItems: "center" }}>
          <div className="sh">
            <h2 className="h2">Stories From Our Customers</h2>
            <p className="sub">The best measure of our work is the experience of the people who choose DUCHI. Discover what our customers say about their watches, shopping experience, and service.</p>
            {real.length > 0 && (
              <div className="row rv-sum">
                <Stars n={Math.round(avg)} />
                <span className="mute sm"><b>{avg.toFixed(1)}</b> from {real.length} {real.length === 1 ? "review" : "reviews"}</span>
              </div>
            )}
          </div>
          {(canPrev || canNext) && (
            <div className="row rv-ctl">
              <button type="button" className="ib arr" onClick={() => go(-1)} disabled={!canPrev} aria-label="Previous reviews">{Icon.left}</button>
              <button type="button" className="ib arr" onClick={() => go(1)} disabled={!canNext} aria-label="Next reviews">{Icon.right}</button>
            </div>
          )}
        </Reveal>

        {list.length ? (
          <div className="rvw" ref={ref} tabIndex={0} role="region" aria-label="Customer reviews" onKeyDown={onKeyDown}>
            {list.map((r, i) => {
              const name = (r.n || "Customer").trim();
              const prod = products[r.pid];
              return (
                <Reveal key={r.id} d={Math.min(i, 4) * 80} className="rcw">
                  <article className="rc">
                    <Stars n={r.r} />
                    <p className="rc-t">{r.t}</p>
                    {r.img && <div className="rimg"><Img id={r.img} alt={`Photo from ${name.split(" ")[0]}`} w={500} /></div>}
                    <div className="rby">
                      <div className="av" aria-hidden="true">{name[0].toUpperCase()}</div>
                      <div className="rby-i">
                        <b className="rby-n">{name.split(" ")[0]}</b>
                        <div className="rby-m">
                          {r.verified && <span className="rby-v">Verified buyer</span>}
                          {r.date && <span>{dt(r.date)}</span>}
                        </div>
                        {prod && <Link className="rby-p" to={`/product/${r.pid}`}>{prod.n}</Link>}
                      </div>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <Reveal className="rv-empty">
            <div className="rv-empty-st" aria-hidden="true"><Stars n={0} /></div>
            <h3>Reviews will appear here</h3>
            <p className="mute">We only publish reviews from customers who have received their watch. Be the first to share your experience once your order arrives.</p>
            <Button to="/shop" variant="o" size="s">Browse watches</Button>
          </Reveal>
        )}
      </div>
    </section>
  );
}
