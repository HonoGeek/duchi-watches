import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { Button, Chip, Field, Input, Panel, Textarea } from "../ui";
import { Allow, Title } from "./Admin";
import { MAX_IMAGE, SOCIALS, readImage, socialUrl, storageUsed, STORAGE_LIMIT } from "../lib";
import { deleteVideo, mmss, probeVideo, putVideo } from "../videoDb";
import heroImg from "../images/hero.jpg";

/* Admin > Site settings: the shop's name, contact details, social links and the home page hero. Everything saved here is used
   across the shop, the admin area, the receipts and the messages, so nothing about the brand is fixed in the code. */

const MAX_HERO_VIDEO = 40 * 1024 * 1024; // a hero video should be short and compressed
const mb = (n) => (n / 1048576).toFixed(n > 1048576 * 10 ? 0 : 1);
const draftOf = (s) => ({ name: s.name, short: s.short, tagline: s.tagline, place: s.place, email: s.email, phone: s.phone, social: { ...s.social }, hero: { ...s.hero } });

export default function SiteSettings() {
  const { site, saveSite, showToast } = useStore();
  const [d, setD] = useState(() => draftOf(site));
  const [busy, setBusy] = useState(false);
  const fresh = useRef([]);   // videos uploaded in this visit
  const trash = useRef([]);   // videos that were replaced or removed: deleted when the settings are saved
  const saved = useRef(site.hero.video?.id);
  saved.current = site.hero.video?.id;
  const init = draftOf(site);
  const dirty = JSON.stringify(d) !== JSON.stringify(init);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const setSocial = (k) => (e) => setD((x) => ({ ...x, social: { ...x.social, [k]: e.target.value } }));
  const setHero = (patch) => setD((x) => ({ ...x, hero: { ...x.hero, ...patch } }));

  // an upload that was never saved should not stay in the browser's storage
  useEffect(() => () => { fresh.current.filter((id) => id !== saved.current).forEach((id) => deleteVideo(id).catch(() => {})); }, []);

  const pickPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) { showToast("Please choose an image file (JPG, PNG or WebP)"); return; }
    if (f.size > MAX_IMAGE) { showToast("That photo is too large. Please choose one under 15 MB."); return; }
    setBusy(true);
    try {
      const data = await readImage(f, 2000, 0.82);
      if (storageUsed() + data.length - (d.hero.image || "").length > STORAGE_LIMIT * 0.97) { showToast("This browser has no space left for that photo. Use a smaller photo or paste an image link."); return; }
      setHero({ image: data, type: "image" });
      showToast("Photo ready. Press Save changes to show it on the home page.");
    } catch { showToast("Could not read that photo. Try a JPG or PNG."); }
    setBusy(false);
  };
  const pickVideo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(f.name)) { showToast("Please choose a video file (MP4 works best)"); return; }
    if (f.size > MAX_HERO_VIDEO) { showToast(`That video is ${mb(f.size)} MB. For the home page keep it under ${mb(MAX_HERO_VIDEO)} MB: a short, compressed clip.`); return; }
    setBusy(true);
    try {
      const meta = await probeVideo(f); // also proves this browser can play it
      const id = "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await putVideo(id, f);
      fresh.current.push(id);
      if (d.hero.video?.id) trash.current.push(d.hero.video.id);
      setHero({ video: { id, name: f.name, size: f.size, poster: meta.poster, duration: meta.duration }, videoUrl: "", type: "video" });
      showToast("Video ready. Press Save changes to show it on the home page.");
    } catch (err) {
      showToast(err?.code === "quota" ? "This browser has no space left for that video. Use a smaller file." : "This browser could not read that video. Please upload an MP4 (H.264) or WebM file.");
    }
    setBusy(false);
  };
  const removeVideo = () => { if (d.hero.video?.id) trash.current.push(d.hero.video.id); setHero({ video: null, videoUrl: "" }); };

  const submit = (e) => {
    e.preventDefault();
    if (!saveSite(d)) return;
    const keep = d.hero.video?.id;
    trash.current.filter((id) => id !== keep).forEach((id) => deleteVideo(id).catch(() => {}));
    trash.current = [];
    fresh.current = fresh.current.filter((id) => id === keep);
  };
  const discard = () => {
    fresh.current.filter((id) => id !== site.hero.video?.id).forEach((id) => deleteVideo(id).catch(() => {}));
    fresh.current = []; trash.current = [];
    setD(draftOf(site));
  };

  const h = d.hero;
  const preview = h.image || heroImg;
  return (
    <Allow sec="site">
      <Title sub="The shop's name, contact details, social links and the home page picture or video. Everything here is used across the shop, the admin area, receipts and messages.">Site settings</Title>
      <form className="stack" onSubmit={submit}>

        <Panel className="stack">
          <h2 className="h3">Brand</h2>
          <div className="two">
            <Field label="Store name" hint="The full name: receipts, the page title and the footer."><Input required maxLength={40} value={d.name} onChange={set("name")} /></Field>
            <Field label="Short name" hint="Shown in the logo and in headings, like “The DUCHI Difference”."><Input required maxLength={16} value={d.short} onChange={set("short")} /></Field>
          </div>
          <Field label="Short description" hint="Shown in the footer."><Input maxLength={140} value={d.tagline} onChange={set("tagline")} /></Field>
          <div className="ss-logo" aria-label="How the logo looks">
            <span className="ax-mark">{(d.short.trim()[0] || "?").toUpperCase()}</span>
            <span className="ax-name">{d.short.trim().toUpperCase() || "NAME"}<i>.</i></span>
          </div>
        </Panel>

        <Panel className="stack">
          <h2 className="h3">Contact details</h2>
          <div className="two">
            <Field label="Phone and WhatsApp number" hint="Used for the WhatsApp chat button, the Contact page and receipts. Leave empty to hide the chat button."><Input type="tel" inputMode="tel" maxLength={20} placeholder="07XX XXX XXX" value={d.phone} onChange={set("phone")} /></Field>
            <Field label="Email" hint="Shown on the Contact page and receipts."><Input required type="email" inputMode="email" maxLength={120} value={d.email} onChange={set("email")} /></Field>
          </div>
          <Field label="Where the shop is"><Input required maxLength={60} value={d.place} onChange={set("place")} /></Field>
        </Panel>

        <Panel className="stack">
          <h2 className="h3">Social links</h2>
          <p className="fhint" style={{ margin: 0 }}>Paste the full link or just the account name, like @yourshop. Only the links you fill in show in the footer of the shop.</p>
          <div className="two">
            {SOCIALS.map(([k, label]) => {
              const r = socialUrl(k, d.social[k]);
              return (
                <div className="f" key={k}>
                  <span className="flab">{label}</span>
                  <Input aria-label={label} maxLength={200} placeholder={`@yourshop or https://…`} value={d.social[k]} onChange={setSocial(k)} aria-invalid={!!r.error} />
                  {r.error ? <span className="ferr" role="alert">{r.error}</span> : r.url ? <span className="fhint">Opens {r.url}</span> : null}
                </div>
              );
            })}
          </div>
          <p className="fhint" style={{ margin: 0 }}>WhatsApp uses the phone number above.</p>
        </Panel>

        <Panel className="stack">
          <h2 className="h3">Home page hero</h2>
          <Field label="Headline" hint="Two short lines look best, for example “Time, well kept.”"><Input required maxLength={60} value={h.headline} onChange={(e) => setHero({ headline: e.target.value })} /></Field>
          <Field label="Text under the headline"><Textarea rows={3} maxLength={300} value={h.text} onChange={(e) => setHero({ text: e.target.value })} /></Field>

          <div>
            <span className="flab">Background</span>
            <div className="row" style={{ marginTop: 8 }} role="group" aria-label="Background type">
              <Chip on={h.type === "image"} aria-pressed={h.type === "image"} onClick={() => setHero({ type: "image" })}>Image</Chip>
              <Chip on={h.type === "video"} aria-pressed={h.type === "video"} onClick={() => setHero({ type: "video" })}>Video</Chip>
            </div>
          </div>

          {h.type === "image" ? (
            <div className="stack">
              <div className="ss-media">
                <div className="ss-th"><img src={preview} alt="Current hero photo" /></div>
                <div className="stack" style={{ gap: 10 }}>
                  <div className="row">
                    <label className={`btn btn-o btn-s upl${busy ? " busy" : ""}`}>{busy ? "Preparing..." : "Upload photo"}<input type="file" accept="image/*" aria-label="Upload a hero photo" disabled={busy} onChange={pickPhoto} /></label>
                    {h.image && <Button type="button" variant="o" size="s" onClick={() => setHero({ image: "" })}>Use the default photo</Button>}
                  </div>
                  <p className="fhint" style={{ margin: 0 }}>A wide, bright photo of at least 1600 px works best. The watch should be in the middle: the sides are cut on phones.</p>
                </div>
              </div>
              <Field label="Or paste a photo link (https://…)"><Input maxLength={500} value={h.image.startsWith("data:") ? "" : h.image} placeholder={h.image.startsWith("data:") ? "An uploaded photo is in use" : "https://…"} onChange={(e) => setHero({ image: e.target.value })} /></Field>
            </div>
          ) : (
            <div className="stack">
              <div className="ss-media">
                <div className="ss-th">{(h.video?.poster || h.image) ? <img src={h.video?.poster || h.image} alt="Video cover" /> : <span className="mute sm">No video yet</span>}</div>
                <div className="stack" style={{ gap: 10 }}>
                  {h.video ? <p style={{ margin: 0 }}><b style={{ fontWeight: 500 }}>{h.video.name}</b><br /><span className="mute sm">{mb(h.video.size)} MB{h.video.duration ? `, ${mmss(h.video.duration)}` : ""}</span></p> : h.videoUrl ? <p className="mute sm" style={{ margin: 0 }}>Using the video link below.</p> : null}
                  <div className="row">
                    <label className={`btn btn-o btn-s upl${busy ? " busy" : ""}`}>{busy ? "Preparing..." : h.video ? "Replace video" : "Upload video"}<input type="file" accept="video/*" aria-label="Upload a hero video" disabled={busy} onChange={pickVideo} /></label>
                    {h.video && <Button type="button" variant="o" size="s" onClick={removeVideo}>Remove video</Button>}
                  </div>
                  <p className="fhint" style={{ margin: 0 }}>It plays quietly in a loop behind the headline, and only while the hero is on screen. Use a short MP4 under {mb(MAX_HERO_VIDEO)} MB, ideally under 15 MB. People who prefer less motion see a still picture instead.</p>
                </div>
              </div>
              <Field label="Or paste a video link (https://… .mp4)"><Input maxLength={500} value={h.videoUrl} placeholder="https://…" onChange={(e) => setHero({ videoUrl: e.target.value })} /></Field>
            </div>
          )}
          <p className="fhint" style={{ margin: 0 }}>Photos and videos are kept in this browser until the shop is connected to a server.</p>
        </Panel>

        <div className="pf-bar">
          <span className="mute sm">{dirty ? "You have unsaved changes" : "No changes yet"}</span>
          <div className="row">
            {dirty && <Button type="button" variant="o" onClick={discard}>Discard</Button>}
            <Button disabled={!dirty || busy}>Save changes</Button>
          </div>
        </div>
      </form>
    </Allow>
  );
}
