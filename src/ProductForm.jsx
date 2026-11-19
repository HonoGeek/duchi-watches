import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "./store";
import { Img, Button, Field, Icon, Input, Select, Textarea } from "./ui";
import { BADGES, DESC_MAX, IM, MAX_HIGHLIGHTS, MAX_PHOTOS, SPEC_FIELDS } from "./data";
import { dtm, fmt, readImage, storageUsed, STORAGE_LIMIT } from "./lib";

const emptySpec = () => Object.fromEntries(SPEC_FIELDS.map(([k]) => [k, ""]));
const dataLen = (list) => list.reduce((a, m) => a + (String(m).startsWith("data:") ? m.length : 0), 0);
const mb = (n) => (Math.max(0, n) / 1e6).toFixed(1);

// A label + controls row that is not a <label>, so clicking the text never presses a stepper button.
const Row = ({ label, hint, children }) => (
  <div className="f"><span className="flab">{label}</span>{children}{hint && <span className="fhint">{hint}</span>}</div>
);

export default function ProductForm({ p, onDone }) {
  const { products, cats, saveProduct, showToast } = useStore();
  const isNew = !p;
  const init = useMemo(() => ({
    n: p?.n || "", s: p?.s || "", c: p?.c || cats[0]?.name || "", tag: p?.tag || "",
    p: p ? String(p.p) : "", stock: p ? String(p.stock) : "0", active: p ? p.active !== false : true,
    im: p?.im ? [...p.im] : [],
    desc: p?.desc || "", highlights: p?.highlights ? [...p.highlights] : [], box: p ? (p.box ?? "Watch, gift box") : "Watch, gift box",
    spec: { ...emptySpec(), ...(p?.spec || {}) },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(0);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(-1);
  const [over, setOver] = useState(false);
  const hlRef = useRef(null);
  const focusHl = useRef(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const catNames = cats.map((c) => c.name);
  if (f.c && !catNames.includes(f.c)) catNames.push(f.c);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => {
    if (!focusHl.current) return;
    focusHl.current = false;
    const ins = hlRef.current?.querySelectorAll("input");
    ins?.[ins.length - 1]?.focus();
  }, [f.highlights.length]);

  /* ---------- photos ---------- */
  const room = MAX_PHOTOS - f.im.length;
  const addFiles = async (list) => {
    const all = [...list];
    const files = all.filter((x) => x.type.startsWith("image/"));
    if (!files.length) { if (all.length) showToast("Please choose image files (JPG, PNG or WebP)"); return; }
    const take = files.slice(0, Math.max(0, room));
    if (take.length < files.length) showToast(`Only ${MAX_PHOTOS} photos fit. ${files.length - take.length} not added.`);
    setBusy(take.length); setErr("");
    const out = [];
    for (const file of take) {
      if (file.size > 20e6) showToast(`${file.name} is too large (20 MB at most)`);
      else { try { out.push(await readImage(file)); } catch { showToast(`Could not read ${file.name}. Try a JPG or PNG.`); } }
      setBusy((b) => b - 1);
    }
    if (out.length) setF((x) => ({ ...x, im: [...x.im, ...out].slice(0, MAX_PHOTOS) }));
  };
  const addLink = () => {
    const u = link.trim();
    if (!u) return;
    if (!/^(https?:\/\/|\/)/.test(u)) { showToast("Image links start with https://"); return; }
    if (room <= 0) { showToast(`Only ${MAX_PHOTOS} photos fit`); return; }
    setF((x) => ({ ...x, im: [...x.im, u] })); setLink(""); setErr("");
  };
  const mv = (i, d) => setF((x) => {
    const j = i + d;
    if (j < 0 || j >= x.im.length) return x;
    const a = [...x.im]; [a[i], a[j]] = [a[j], a[i]]; return { ...x, im: a };
  });
  const cover = (i) => setF((x) => { const a = [...x.im]; const [m] = a.splice(i, 1); return { ...x, im: [m, ...a] }; });
  const rm = (i) => setF((x) => ({ ...x, im: x.im.filter((_, k) => k !== i) }));
  const drop = (to) => {
    if (drag < 0 || drag === to) { setDrag(-1); return; }
    setF((x) => { const a = [...x.im]; const [m] = a.splice(drag, 1); a.splice(to, 0, m); return { ...x, im: a }; });
    setDrag(-1);
  };
  const projected = storageUsed() + dataLen(f.im) - dataLen(init.im);
  const pct = Math.min(100, Math.round((projected / STORAGE_LIMIT) * 100));

  /* ---------- highlights ---------- */
  const setHl = (i, v) => setF((x) => ({ ...x, highlights: x.highlights.map((h, k) => (k === i ? v : h)) }));
  const addHl = () => { focusHl.current = true; setF((x) => (x.highlights.length >= MAX_HIGHLIGHTS ? x : { ...x, highlights: [...x.highlights, ""] })); };
  const rmHl = (i) => setF((x) => ({ ...x, highlights: x.highlights.filter((_, k) => k !== i) }));

  const stepStock = (d) => setF((x) => ({ ...x, stock: String(Math.max(0, (parseInt(x.stock, 10) || 0) + d)) }));
  const cancel = () => { if (dirty && !window.confirm("Discard your changes?")) return; onDone(); };

  const submit = (e) => {
    e.preventDefault();
    const price = Number(f.p), stock = Math.floor(Number(f.stock));
    const fail = (m, id) => { setErr(m); document.getElementById(id || "pf-err")?.scrollIntoView({ behavior: "smooth", block: "center" }); };
    if (!f.n.trim() || !f.s.trim()) return fail("Add a name and a dial or colour.", "pf-basics");
    if (!f.c) return fail("Choose a category. Add one in Categories first if the list is empty.", "pf-basics");
    if (!(price > 0)) return fail("Add a price above 0.", "pf-price");
    if (!(stock >= 0)) return fail("Stock cannot be negative.", "pf-price");
    if (!f.im.length) return fail("Add at least one photo.", "pf-photos");
    if (projected > STORAGE_LIMIT * 0.97) return fail("These photos are too big for the browser storage. Remove a photo or use image links.", "pf-photos");
    saveProduct({
      id: isNew ? products.length : p.id, n: f.n.trim(), s: f.s.trim(), c: f.c, p: price, stock, tag: f.tag.trim(), active: f.active,
      im: f.im, desc: f.desc.trim(), highlights: f.highlights.map((h) => h.trim()).filter(Boolean), box: f.box.trim(),
      spec: Object.fromEntries(SPEC_FIELDS.map(([k]) => [k, (f.spec[k] || "").trim()])),
    });
    onDone();
  };

  return (
    <form className="pf" onSubmit={submit}>
      <div className="pf-top">
        <button type="button" className="lnk pf-back" onClick={cancel}>← Back to products</button>
        <h1 className="h2">{isNew ? "New product" : "Edit product"}</h1>
        <p className="mute">{isNew ? "Fill in the sections below, then save. You can change everything later." : f.n}</p>
        {!isNew && (
          <p className="mute sm">
            {p.createdAt ? `Added ${dtm(p.createdAt)}` : "Added: date not recorded"}
            {p.updatedAt && p.updatedAt !== p.createdAt ? `. Last updated ${dtm(p.updatedAt)}${p.updatedBy ? ` by ${p.updatedBy}` : ""}` : ""}
          </p>
        )}
      </div>
      {err && <div className="pf-err" id="pf-err" role="alert">{err}</div>}

      <section className="pf-sec" id="pf-basics">
        <div className="pf-h"><h2>Basics</h2><p>What shoppers see first.</p></div>
        <div className="pf-b">
          <div className="two">
            <Field label="Name"><Input required value={f.n} onChange={set("n")} placeholder="e.g. Axis Day-Date" /></Field>
            <Field label="Dial or colour"><Input required value={f.s} onChange={set("s")} placeholder="e.g. Teal dial" /></Field>
          </div>
          <div className="two">
            <Row label="Category" hint={<Link to="/admin/categories">Manage categories</Link>}>
              <Select value={f.c} onChange={set("c")} aria-label="Category">
                {!catNames.length && <option value="">No categories yet</option>}
                {catNames.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Row>
            <Field label="Badge (optional)">
              <Input list="pf-badges" value={f.tag} onChange={set("tag")} placeholder="e.g. New" maxLength={16} />
              <datalist id="pf-badges">{BADGES.map((b) => <option key={b} value={b} />)}</datalist>
            </Field>
          </div>
          <label className="fchk"><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} /><span>Visible in the store</span></label>
        </div>
      </section>

      <section className="pf-sec" id="pf-price">
        <div className="pf-h"><h2>Price and stock</h2><p>Stock goes down automatically when an order is placed.</p></div>
        <div className="pf-b two">
          <Row label="Price" hint={Number(f.p) > 0 ? fmt(f.p) : "In Rwandan francs"}>
            <div className="inpre"><span>RWF</span><Input type="number" min="1" step="1" required inputMode="numeric" value={f.p} onChange={set("p")} aria-label="Price in RWF" /></div>
          </Row>
          <Row label="Stock" hint={Number(f.stock) === 0 ? "Shown as sold out" : Number(f.stock) <= 5 ? "Shown as low stock" : "In stock"}>
            <div className="nstep">
              <button type="button" onClick={() => stepStock(-1)} aria-label="Less stock">−</button>
              <Input type="number" min="0" step="1" required inputMode="numeric" value={f.stock} onChange={set("stock")} aria-label="Stock" />
              <button type="button" onClick={() => stepStock(1)} aria-label="More stock">+</button>
            </div>
          </Row>
        </div>
      </section>

      <section className="pf-sec" id="pf-photos">
        <div className="pf-h">
          <h2>Photos</h2>
          <p>Upload as many as you like, up to {MAX_PHOTOS}. The first photo is the cover shown in the shop. Drag photos to reorder them.</p>
          <span className="pf-count">{f.im.length} / {MAX_PHOTOS}</span>
        </div>
        <div className="pf-b">
          <label className={`dz${over ? " over" : ""}${room <= 0 ? " full" : ""}`}
            onDragEnter={() => setOver(true)} onDragLeave={() => setOver(false)} onDrop={() => setOver(false)}>
            <input type="file" accept="image/*" multiple disabled={room <= 0} aria-label="Upload photos"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            <b>{room <= 0 ? "Photo limit reached" : <>Drop photos here or <u>browse</u></>}</b>
            <span className="mute sm">JPG, PNG or WebP. You can pick several at once.</span>
          </label>

          {(f.im.length > 0 || busy > 0) && (
            <ul className="pg">
              {f.im.map((m, i) => (
                <li key={i + ":" + m.length} className={`pth${drag === i ? " drag" : ""}`} draggable
                  onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} onDragEnd={() => setDrag(-1)}>
                  <Img id={m} alt={`Photo ${i + 1}`} w={320} draggable={false} />
                  {i === 0 && <span className="pth-cover">Cover</span>}
                  <div className="pth-bar">
                    <button type="button" onClick={() => mv(i, -1)} disabled={i === 0} aria-label={`Move photo ${i + 1} left`}>{Icon.left}</button>
                    {i > 0 && <button type="button" onClick={() => cover(i)} aria-label={`Make photo ${i + 1} the cover`} title="Make cover">★</button>}
                    <button type="button" onClick={() => mv(i, 1)} disabled={i === f.im.length - 1} aria-label={`Move photo ${i + 1} right`}>{Icon.right}</button>
                    <button type="button" className="rm" onClick={() => rm(i)} aria-label={`Remove photo ${i + 1}`}>{Icon.cross}</button>
                  </div>
                </li>
              ))}
              {Array.from({ length: busy }).map((_, k) => <li key={"b" + k} className="pth busy" aria-label="Processing photo"><i /></li>)}
            </ul>
          )}

          <div className="pf-link">
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste an image link (https://...)" aria-label="Image link"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} />
            <Button type="button" variant="o" size="s" onClick={addLink}>Add link</Button>
          </div>
          {!f.im.length && <button type="button" className="lnk pf-sample" onClick={() => setF((x) => ({ ...x, im: IM.slice(0, 4) }))}>Use sample photos instead</button>}
          <div className="pf-meter" title="Photos are kept in this browser until the backend is connected">
            <div><i className={pct > 85 ? "hot" : ""} style={{ width: pct + "%" }} /></div>
            <span>Browser storage: {mb(projected)} MB of about 5 MB</span>
          </div>
        </div>
      </section>

      <section className="pf-sec">
        <div className="pf-h"><h2>Details</h2><p>Shown on the product page. Replaces the old Word specification sheet.</p></div>
        <div className="pf-b">
          <div>
            <Field label="Description">
              <Textarea rows={5} maxLength={DESC_MAX} value={f.desc} onChange={set("desc")} placeholder="Tell shoppers what makes this watch special: the look, the fit and who it suits." />
            </Field>
            <div className="pf-cnt">{f.desc.length} / {DESC_MAX}</div>
          </div>
          <div className="pf-hl" ref={hlRef}>
            <span className="flab">Highlights <small>Short selling points, up to {MAX_HIGHLIGHTS}</small></span>
            {f.highlights.map((h, i) => (
              <div className="pf-hli" key={i}>
                <i aria-hidden="true" />
                <Input value={h} maxLength={80} onChange={(e) => setHl(i, e.target.value)} placeholder="e.g. Sapphire crystal glass" aria-label={`Highlight ${i + 1}`}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (h.trim()) addHl(); } }} />
                <button type="button" className="x" onClick={() => rmHl(i)} aria-label={`Remove highlight ${i + 1}`}>{Icon.cross}</button>
              </div>
            ))}
            {f.highlights.length < MAX_HIGHLIGHTS && <button type="button" className="lnk pf-add" onClick={addHl}>+ Add a highlight</button>}
          </div>
          <Field label="What is in the box"><Input value={f.box} onChange={set("box")} placeholder="e.g. Watch, gift box, warranty card" /></Field>
        </div>
      </section>

      <section className="pf-sec">
        <div className="pf-h"><h2>Specification</h2><p>Only the rows you fill in are shown.</p></div>
        <div className="pf-b two">
          {SPEC_FIELDS.map(([k, l, hint]) => (
            <Field key={k} label={l}><Input value={f.spec[k] || ""} placeholder={hint} onChange={(e) => setF((x) => ({ ...x, spec: { ...x.spec, [k]: e.target.value } }))} /></Field>
          ))}
        </div>
      </section>

      <div className="pf-bar">
        <span className="mute sm">{dirty ? "You have unsaved changes" : isNew ? "Nothing entered yet" : "No changes yet"}</span>
        <div className="row">
          <Button type="button" variant="o" onClick={cancel}>Cancel</Button>
          <Button>{isNew ? "Save product" : "Save changes"}</Button>
        </div>
      </div>
    </form>
  );
}
