import { useEffect, useRef, useState } from "react";

/* Small chart kit for the admin dashboard. No chart library: everything is drawn as SVG.
   TimeChart: bar, line or area over time. Donut and HBars: a breakdown into parts. Seg: a small switch between options. */

// 1200 -> "1.2k", 2500000 -> "2.5M"
export const short = (v) => {
  const t = (n, s) => String(+n.toFixed(1)) + s;
  return v >= 1e6 ? t(v / 1e6, "M") : v >= 1e3 ? t(v / 1e3, "k") : String(Math.round(v));
};

const useWidth = (def = 640) => {
  const ref = useRef(null);
  const [w, setW] = useState(def);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setW(el.clientWidth || def);
    read();
    if (typeof ResizeObserver === "undefined") { addEventListener("resize", read); return () => removeEventListener("resize", read); }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [def]);
  return [ref, w];
};

// A round top value for the y axis, so the grid lines land on tidy numbers.
const niceMax = (v, whole) => {
  if (v <= 0) return 4;
  if (whole && v <= 40) return Math.max(4, Math.ceil(v / 4) * 4); // counts stay whole numbers
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

export const Seg = ({ value, onChange, options, label }) => (
  <div className="db-seg" role="group" aria-label={label}>
    {options.map(([k, l]) => <button key={k} type="button" className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
  </div>
);

/* data: [{ l: axis label, tip: hover title, v: number }]. type: "bar" | "line" | "area". money: format values as RWF. */
export function TimeChart({ data, type = "bar", money = true, label, format }) {
  const [ref, W] = useWidth();
  const [hov, setHov] = useState(-1);
  const H = 250, L = 46, R = 14, T = 16, B = 30;
  const n = data.length;
  const pw = Math.max(60, W - L - R), ph = H - T - B;
  const mx = niceMax(Math.max(0, ...data.map((d) => d.v)), !money);
  const step = pw / Math.max(1, n);
  const x = (i) => L + step * (i + 0.5);
  const y = (v) => T + ph - (v / mx) * ph;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / 52))));
  const ticks = [0, 1, 2, 3, 4].map((k) => (mx / 4) * k);
  const fmtV = format || ((v) => (money ? short(v) : String(v)));
  const bw = Math.min(44, step * 0.62);
  const pts = data.map((d, i) => `${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`);
  const line = n ? "M" + pts.join(" L") : "";
  const area = n ? `${line} L${x(n - 1).toFixed(1)} ${T + ph} L${x(0).toFixed(1)} ${T + ph} Z` : "";
  const gid = useRef("g" + Math.random().toString(36).slice(2, 7)).current;
  const tip = hov >= 0 ? data[hov] : null;

  return (
    <div className="db-chart" ref={ref} style={{ height: H }} onPointerLeave={() => setHov(-1)}>
      <svg width={W} height={H} role="img" aria-label={label}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--gold)", stopOpacity: 0.38 }} />
            <stop offset="100%" style={{ stopColor: "var(--gold)", stopOpacity: 0.02 }} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line className="db-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{money ? short(t) : String(+t.toFixed(1))}</text>
          </g>
        ))}
        {type === "bar" && data.map((d, i) => d.v > 0 && (
          <rect key={i} className={`db-bar${i === n - 1 ? " last" : ""}${hov === i ? " hot" : ""}`} x={x(i) - bw / 2} y={y(d.v)} width={bw} height={T + ph - y(d.v)} rx={Math.min(5, bw / 2)} />
        ))}
        {type === "area" && n > 1 && <path d={area} fill={`url(#${gid})`} />}
        {type !== "bar" && n > 1 && <path className="db-line" d={line} />}
        {type !== "bar" && data.map((d, i) => (n <= 31 || hov === i) && <circle key={i} className={`db-dot${hov === i ? " hot" : ""}`} cx={x(i)} cy={y(d.v)} r={hov === i ? 5.5 : 3.5} />)}
        {hov >= 0 && type !== "bar" && <line className="db-guide" x1={x(hov)} x2={x(hov)} y1={T} y2={T + ph} />}
        {n <= 8 && type === "bar" && data.map((d, i) => d.v > 0 && <text key={"v" + i} className="db-val" x={x(i)} y={y(d.v) - 6} textAnchor="middle">{fmtV(d.v)}</text>)}
        {data.map((d, i) => (n - 1 - i) % every === 0 && <text key={"l" + i} x={x(i)} y={H - 9} textAnchor="middle">{d.l}</text>)}
        {data.map((d, i) => (
          <rect key={"h" + i} className="db-hit" x={L + step * i} y={T} width={step} height={ph}
            onPointerEnter={() => setHov(i)} onPointerMove={() => setHov(i)} onClick={() => setHov(i)} />
        ))}
      </svg>
      {tip && (
        <div className="db-tip" style={{ left: Math.min(Math.max(x(hov), 70), W - 70), top: Math.max(y(tip.v) - 10, 44) }} role="status">
          <span>{tip.tip || tip.l}</span><b>{money ? "RWF " + Number(tip.v).toLocaleString("en-US") : tip.v}</b>
        </div>
      )}
    </div>
  );
}

const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);

function Legend({ items, total }) {
  return (
    <ul className="db-leg">
      {items.map((it, i) => (
        <li key={it.label} className={`db-c${i}`}>
          <i aria-hidden="true" /><span className="nm">{it.label}</span><b>{it.text}</b><em>{pct(it.v, total)}%</em>
        </li>
      ))}
    </ul>
  );
}

/* items: [{ label, v, text }], center: big text in the middle, sub: small text under it. */
export function Donut({ items, center, sub }) {
  const total = items.reduce((a, r) => a + r.v, 0);
  const r = 62, C = 2 * Math.PI * r, gap = items.length > 1 ? 3 : 0;
  let acc = 0;
  return (
    <div className="db-donut">
      <svg viewBox="0 0 160 160" role="img" aria-label={`Breakdown: ${items.map((i) => `${i.label} ${pct(i.v, total)}%`).join(", ")}`}>
        <circle className="db-ring" cx="80" cy="80" r={r} />
        {total > 0 && items.map((it, i) => {
          const len = (it.v / total) * C;
          const el = <circle key={it.label} className={`db-seg-c db-c${i}`} cx="80" cy="80" r={r} strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
        <text x="80" y="78" textAnchor="middle" className="db-cm">{center}</text>
        <text x="80" y="102" textAnchor="middle" className="db-cs">{sub}</text>
      </svg>
      <Legend items={items} total={total} />
    </div>
  );
}

export function HBars({ items }) {
  const total = items.reduce((a, r) => a + r.v, 0), mx = Math.max(1, ...items.map((r) => r.v));
  return (
    <ul className="db-hb">
      {items.map((it, i) => (
        <li key={it.label} className={`db-c${i}`}>
          <div className="t"><span>{it.label}</span><b>{it.text} <em>{pct(it.v, total)}%</em></b></div>
          <div className="b"><i style={{ width: `${(it.v / mx) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
