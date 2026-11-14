import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../store";
import { Button, Chip, Input, Select, ProductCard, Reveal } from "../ui";
import { CATS, PRICE_BANDS } from "../data";

export default function Shop() {
  const { products } = useStore();
  const [sp, setSp] = useSearchParams();
  const cat = sp.get("cat") || "All";
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");
  const [band, setBand] = useState(0);
  const [inStock, setInStock] = useState(false);
  const [view, setView] = useState("grid");
  const [open, setOpen] = useState(false); // filters panel on phones

  const [, lo, hi] = PRICE_BANDS[band];
  let list = products.filter((p) =>
    p.active !== false && (cat === "All" || p.c === cat) && p.n.toLowerCase().includes(q.toLowerCase())
    && p.p >= lo && p.p < hi && (!inStock || p.stock > 0));
  if (sort === "lo") list = [...list].sort((a, b) => a.p - b.p);
  if (sort === "hi") list = [...list].sort((a, b) => b.p - a.p);
  if (sort === "az") list = [...list].sort((a, b) => a.n.localeCompare(b.n));

  const active = (band ? 1 : 0) + (inStock ? 1 : 0) + (q ? 1 : 0);
  const clear = () => { setBand(0); setInStock(false); setQ(""); setSp({}); };

  return (
    <section style={{ paddingTop: 56 }}><div className="wrap">
      <h1 className="h2">Shop all watches</h1>
      <p className="mute" style={{ margin: "8px 0 28px" }}>{list.length} {list.length === 1 ? "watch" : "watches"}</p>

      <div className="shopbar">
        <div className="row scats">
          {["All", ...CATS].map((c) => <Chip key={c} on={c === cat} onClick={() => setSp(c === "All" ? {} : { cat: c })}>{c}</Chip>)}
        </div>
        <div className="stools">
          <label className="ssearch">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search watches" aria-label="Search" />
          </label>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="ssort" aria-label="Sort">
            <option value="new">Featured</option><option value="lo">Price: low to high</option><option value="hi">Price: high to low</option><option value="az">Name: A to Z</option>
          </Select>
        </div>
      </div>

      <div className="fbar">
        <button type="button" className="fbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
          Filters{active ? <span className="fcnt">{active}</span> : null}
        </button>
        <div className={`fopts${open ? " open" : ""}`}>
          <Select value={band} onChange={(e) => setBand(+e.target.value)} className="fprice" aria-label="Price range">
            {PRICE_BANDS.map(([l], i) => <option key={l} value={i}>{l}</option>)}
          </Select>
          <label className="fchk"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /><span>In stock only</span></label>
          {(active > 0 || cat !== "All") && <button type="button" className="lnk" onClick={clear}>Clear filters</button>}
        </div>
        <div className="vmode" role="group" aria-label="View mode">
          <button type="button" className={view === "grid" ? "on" : ""} aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => setView("grid")}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor" /></svg>
          </button>
          <button type="button" className={view === "list" ? "on" : ""} aria-pressed={view === "list"} aria-label="List view" onClick={() => setView("list")}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 5h16v3H4zM4 10.5h16v3H4zM4 16h16v3H4z" fill="currentColor" /></svg>
          </button>
        </div>
      </div>

      <div className={`grid${view === "list" ? " list" : ""}`}>
        {list.length ? list.map((p, i) => <Reveal key={p.id} d={(i % 4) * 70}><ProductCard p={p} view={view} /></Reveal>)
          : (
            <div className="sempty">
              <p className="mute">No watches match your filters.</p>
              <Button variant="o" size="s" onClick={clear}>Clear filters</Button>
            </div>
          )}
      </div>
    </div></section>
  );
}
