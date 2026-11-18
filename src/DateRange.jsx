import { useRef, useState } from "react";
import { Button, Icon } from "./ui";
import { useOutside } from "./AdminShell";

/* One date field for the whole admin area. It shows a single button; pressing it opens a month calendar.
   Tap a day to start, tap another day to finish the range (tap the same day twice for one day).
   Days listed in `counts` (a { "yyyy-mm-dd": number } object) get a green dot, so you can see where there is data.
   <DateRange value={{ from: "2026-11-10", to: "2026-11-18" }} onChange={({ from, to }) => ...} counts={...} /> */
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // a date on this computer, as yyyy-mm-dd
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const short = (s) => {
  const d = parse(s), o = { day: "numeric", month: "short" };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = "numeric";
  return d.toLocaleDateString("en-GB", o);
};
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export default function DateRange({ value, onChange, counts = {} }) {
  const { from, to } = value;
  const hi = to || from; // a start day without an end day means that one day
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: 0, m: 0 });
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));

  // The calendar opens on the chosen start day, or on the latest day that has data, so the dots are visible straight away.
  const toggle = () => {
    if (!open) {
      const keys = Object.keys(counts).sort();
      const d = from ? parse(from) : keys.length ? parse(keys[keys.length - 1]) : new Date();
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
    setOpen((o) => !o);
  };
  const step = (n) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const pick = (s) => {
    if (!from || to) onChange({ from: s, to: "" });
    else if (s < from) onChange({ from: s, to: from });
    else onChange({ from, to: s });
  };

  const first = new Date(view.y, view.m, 1);
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const title = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const today = ymd(new Date());
  const label = !from ? "Select dates" : hi === from ? short(from) : `${short(from)} → ${short(hi)}`;

  return (
    <div className="dr" ref={ref}>
      <button type="button" className={`dr-btn${from ? " on" : ""}`} onClick={toggle} aria-expanded={open} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
        <span>{label}</span>
      </button>
      {open && (
        <div className="dr-pop" role="dialog" aria-label="Choose dates">
          <span className="dr-grab" aria-hidden="true" />
          <div className="dr-h">
            <button type="button" onClick={() => step(-1)} aria-label="Previous month">{Icon.left}</button>
            <b aria-live="polite">{title}</b>
            <button type="button" onClick={() => step(1)} aria-label="Next month">{Icon.right}</button>
          </div>
          <div className="dr-w" aria-hidden="true">{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
          <div className="dr-g">
            {Array.from({ length: first.getDay() }, (_, i) => <div key={"b" + i} className="dr-c" />)}
            {Array.from({ length: days }, (_, i) => {
              const d = i + 1, s = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
              const edge = s === from || s === hi;
              const inR = !!from && from !== hi && s >= from && s <= hi;
              const n = counts[s] || 0;
              return (
                <div key={s} className={`dr-c${inR ? " in" : ""}${inR && s === from ? " st" : ""}${inR && s === hi ? " en" : ""}`}>
                  <button type="button" className={`dr-d${edge ? " sel" : ""}${n ? " mark" : ""}${s === today ? " today" : ""}`} aria-pressed={edge}
                    aria-label={`${d} ${first.toLocaleDateString("en-GB", { month: "long" })} ${view.y}${n ? `, ${n} ${n === 1 ? "action" : "actions"}` : ""}`}
                    onClick={() => pick(s)}>{d}</button>
                </div>
              );
            })}
          </div>
          <div className="dr-f">
            <span className="dr-key"><i aria-hidden="true" />Has activity</span>
            <span className="mute sm dr-hint">{!from ? "Tap a day to start" : !to ? "Tap an end day, or press Done" : ""}</span>
          </div>
          <div className="row dr-act">
            <Button type="button" variant="o" size="s" onClick={() => onChange({ from: "", to: "" })} disabled={!from}>Clear</Button>
            <Button type="button" size="s" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
