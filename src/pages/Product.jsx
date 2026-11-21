import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Heart, Icon, Panel, ProductCard, Qty, Reveal, StockLeft } from "../ui";
import { SPEC_FIELDS } from "../data";
import ProductReviews from "../ProductReviews";
import { Stars } from "../ui";
import { fmt } from "../lib";

export default function Product() {
  const { id } = useParams();
  const { products, zones, addToCart, reviewStats } = useStore();
  const [qty, setQty] = useState(1);
  const [ph, setPh] = useState(0);
  const rowRef = useRef(null);
  const [bar, setBar] = useState(false);
  // Sticky "Add to cart" bar on phones, shown once the main button scrolls out of view.
  useEffect(() => {
    document.body.classList.add("has-buybar");
    return () => document.body.classList.remove("has-buybar");
  }, []);
  useEffect(() => {
    const el = rowRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  const p = products[+id];
  if (!p) return <Navigate to="/shop" replace />;
  const related = products.filter((x) => x.active !== false && x.id !== p.id).slice(0, 4);
  const add = () => { if (addToCart(p.id, qty)) setQty(1); };

  return (
    <>
    <div className="wrap">
      <div className="crumb"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / {p.n}</div>
      <div className="split" style={{ alignItems: "start", paddingBottom: 80 }}>
        <div className="gal">
          <div className="main"><Img id={p.im[ph]} alt={p.n} w={1000} /></div>
          <div className="thumbs">
            {p.im.map((m, k) => (
              <button key={k} className={k === ph ? "on" : ""} onClick={() => setPh(k)} aria-label={`Photo ${k + 1}`}><Img id={m} w={200} /></button>
            ))}
          </div>
        </div>
        <div className="stack">
          <div><h1 className="h2">{p.n}</h1><p className="mute">{p.s} · {p.c}</p>
            {reviewStats[p.id] && (
              <button type="button" className="prat" onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}>
                <Stars n={Math.round(reviewStats[p.id].avg)} /><span>{reviewStats[p.id].avg.toFixed(1)} · {reviewStats[p.id].count} {reviewStats[p.id].count === 1 ? "review" : "reviews"}</span>
              </button>
            )}
          </div>
          <div className="h3">{fmt(p.p)}</div>
          <p className="mute pdesc">{p.desc || "A dependable everyday watch with a clean face and a comfortable fit."}</p>
          {p.highlights?.length > 0 && (
            <ul className="hl">
              {p.highlights.map((h, i) => <li key={h + i}><span className="ci">{Icon.check}</span>{h}</li>)}
            </ul>
          )}
          <StockLeft p={p} q={qty} />
          <div className="row" ref={rowRef}>
            <Qty value={qty} max={p.stock} onMinus={() => setQty(Math.max(1, qty - 1))} onPlus={() => setQty(Math.min(qty + 1, Math.max(1, p.stock)))} />
            {p.stock <= 0
              ? <Button variant="o" disabled style={{ flex: 1 }}>Sold out</Button>
              : <Button onClick={add} style={{ flex: 1 }}>Add to cart</Button>}
            <Heart id={p.id} page />
          </div>
          <Panel>
            <table>
              <tbody>
                <tr><td>Category</td><td>{p.c}</td></tr>
                <tr><td>Dial</td><td>{p.s}</td></tr>
                {SPEC_FIELDS.filter(([k]) => p.spec?.[k]).map(([k, l]) => <tr key={k}><td>{l}</td><td>{p.spec[k]}</td></tr>)}
                {(p.box ?? "Watch, gift box") && <tr><td style={{ border: 0 }}>In the box</td><td style={{ border: 0 }}>{p.box ?? "Watch, gift box"}</td></tr>}
              </tbody>
            </table>
          </Panel>
          <p className="sm mute">Delivery: {zones.map((z) => `${z.name} ${fmt(z.fee)}`).join(", ")}.</p>
        </div>
      </div>
      <div className={`buybar${bar ? " show" : ""}`}>
        <div style={{ minWidth: 0 }}><b className="ell">{p.n}</b><span className="mute sm">{fmt(p.p)}</span></div>
        {p.stock <= 0 ? <Button variant="o" disabled>Sold out</Button> : <Button onClick={add}>Add to cart</Button>}
      </div>
      <h2 className="h3" style={{ marginBottom: 24 }}>You may also like</h2>
      <div className="grid" style={{ paddingBottom: 96 }}>{related.map((x, i) => <Reveal key={x.id} d={i * 80}><ProductCard p={x} /></Reveal>)}</div>
    </div>
    <ProductReviews p={p} />
    </>
  );
}
