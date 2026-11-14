import { useStore } from "./store";
import { Field, Input } from "./ui";
import { fmt } from "./lib";
import { ussd, telHref } from "./pay";

// Shows the merchant code, a button that opens the phone dialer with the USSD code, and optional proof fields.
export default function MomoPanel({ net, amount, tx, pp, setTx, setPp }) {
  const { payCfg, showToast } = useStore();
  const cfg = payCfg[net];
  const label = net === "mtn" ? "MTN Mobile Money" : "Airtel Money";
  const code = ussd(cfg.tpl, cfg.code, amount);
  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); showToast("Copied"); } catch { showToast("Copy is not available on this device"); }
  };
  return (
    <div className="paybox stack">
      <b>Pay with {label}</b>
      <div className="payrow"><span className="mute sm">Amount to pay</span><b>{fmt(amount)}</b></div>
      <div className="payrow">
        <span className="mute sm">Merchant code</span>
        <span><b className="ussd">{cfg.code}</b> <button type="button" className="lnk" onClick={() => copy(cfg.code)}>Copy</button></span>
      </div>
      <a className="btn btn-g btn-b dial" href={telHref(code)}>Dial {code} to pay</a>
      <ol className="sm mute steps2">
        <li>Tap the button. Your phone opens the dialer with the code filled in.</li>
        <li>Press call, then confirm the amount and enter your PIN.</li>
        <li>Come back here and place your order. We confirm your payment before dispatch.</li>
      </ol>
      <p className="sm mute">On a computer? Dial {code} on your phone.</p>
      <Field label="Number you paid from (optional)"><Input type="tel" value={pp} onChange={(e) => setPp(e.target.value)} placeholder="07XX XXX XXX" /></Field>
      <Field label="Transaction ID from the SMS (optional)"><Input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="e.g. 1234567890" /></Field>
    </div>
  );
}
