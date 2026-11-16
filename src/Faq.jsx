import { useId, useMemo, useState } from "react";

// "How long does delivery take?" and "how long does delivery take" count as the same question.
const norm = (q) => String(q || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Accessible accordion. items is a list of [question, answer] pairs.
// Questions without an answer and repeated questions are dropped, so every row always has its own answer.
// One answer is open at a time. Arrow keys, Home and End move between questions.
export default function Faq({ items, openFirst = true }) {
  const uid = useId();
  const list = useMemo(() => {
    const seen = new Set();
    return items.filter(([q, a]) => {
      const k = norm(q);
      if (!k || !String(a || "").trim() || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [items]);
  const [open, setOpen] = useState(openFirst ? 0 : -1);
  if (!list.length) return null;

  const move = (e, i) => {
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    document.getElementById(`${uid}-q${(to + list.length) % list.length}`)?.focus();
  };

  return (
    <div className="faq">
      {list.map(([q, a], i) => {
        const on = open === i;
        return (
          <div className={`faq-i${on ? " on" : ""}`} key={norm(q)}>
            <h3>
              <button type="button" id={`${uid}-q${i}`} className="faq-q" aria-expanded={on} aria-controls={`${uid}-a${i}`}
                onClick={() => setOpen(on ? -1 : i)} onKeyDown={(e) => move(e, i)}>
                <span>{q}</span><span className="faq-ic" aria-hidden="true" />
              </button>
            </h3>
            <div className="faq-a" id={`${uid}-a${i}`} role="region" aria-labelledby={`${uid}-q${i}`}>
              <div><p>{a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
