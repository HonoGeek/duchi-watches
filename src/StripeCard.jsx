import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useStore } from "./store";
import { Field, Input } from "./ui";

// Set VITE_STRIPE_PUBLISHABLE_KEY (pk_test_... or pk_live_...) in a .env file to use the real Stripe card field.
const KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const STRIPE_READY = !!KEY;
const stripePromise = KEY ? loadStripe(KEY) : null;

// Real Stripe card field. Registers a function the checkout calls to turn the card into a Stripe PaymentMethod.
function Live({ reg, name, email }) {
  const stripe = useStripe();
  const elements = useElements();
  const { theme } = useStore();
  useEffect(() => {
    reg.current = async () => {
      if (!stripe || !elements) return { error: "The card form is still loading" };
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card", card: elements.getElement(CardElement), billing_details: { name, email },
      });
      if (error) return { error: error.message };
      return { id: paymentMethod.id, brand: paymentMethod.card.brand, last4: paymentMethod.card.last4 };
    };
    return () => { reg.current = null; };
  }, [stripe, elements, name, email, reg]);
  const color = theme === "dark" ? "#f5f5f7" : "#1d1d1f";
  return (
    <div className="cardbox">
      <CardElement options={{ style: { base: { fontSize: "16px", color, fontFamily: "Inter, system-ui, sans-serif", "::placeholder": { color: "#8e8e93" } } } }} />
    </div>
  );
}

// Preview card form used when no Stripe key is set. Nothing is charged or stored.
function Demo({ reg }) {
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const digits = num.replace(/\D/g, "");
  useEffect(() => {
    reg.current = async () => {
      if (digits.length < 13) return { error: "Enter a valid card number" };
      if (!/^\d\d\/\d\d$/.test(exp)) return { error: "Enter the expiry as MM/YY" };
      if (cvc.length < 3) return { error: "Enter the 3 digit security code" };
      return { id: "preview_" + Date.now(), brand: "card", last4: digits.slice(-4) };
    };
    return () => { reg.current = null; };
  }, [digits, exp, cvc, reg]);
  return (
    <div className="stack">
      <Field label="Card number">
        <Input inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={num}
          onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())} />
      </Field>
      <div className="two keep">
        <Field label="Expiry (MM/YY)">
          <Input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={exp}
            onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setExp(d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d); }} />
        </Field>
        <Field label="Security code">
          <Input inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </Field>
      </div>
    </div>
  );
}

export default function StripeCard({ reg, name, email }) {
  return (
    <div className="paybox stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>Pay by card</b>
        <span className="mute sm">{STRIPE_READY ? "Secured by Stripe" : "Stripe card form (preview)"}</span>
      </div>
      {STRIPE_READY
        ? <Elements stripe={stripePromise}><Live reg={reg} name={name} email={email} /></Elements>
        : <>
            <Demo reg={reg} />
            <p className="sm mute">Preview mode: no Stripe key is set, so this card is not charged or stored. Add VITE_STRIPE_PUBLISHABLE_KEY to go live.</p>
          </>}
    </div>
  );
}
