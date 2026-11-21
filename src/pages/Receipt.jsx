import { Link, Navigate, useParams } from "react-router-dom";
import { useStore } from "../store";
import { Button } from "../ui";
import { SHOP } from "../data";
import { dt, dtm, fmt } from "../lib";
import "../receipt.css";

// A printable receipt for one order. The customer can open their own orders; the admin can open any order.
// "Print or save as PDF" opens the browser's print window, where PDF can be chosen as the destination.
export default function Receipt() {
  const { id } = useParams();
  const { allOrders, user, adm, getProduct } = useStore();
  const o = allOrders.find((x) => x.id === id);
  const mine = !!(o && user && o.email === user.email);
  if (!o || !(mine || adm)) return <Navigate to={adm ? "/admin/orders" : "/account/orders"} replace />;
  const back = mine ? `/account/orders/${o.id}` : `/admin/orders/${o.id}`;
  const paid = (o.payStatus || "Pending") === "Paid";
  const state = o.status === "Cancelled" ? ["cancelled", "CANCELLED"] : paid ? ["paid", "PAID"] : ["pending", "PAYMENT PENDING"];
  const refund = o.returnReq?.refund;
  return (
    <div className="rp-wrap">
      <div className="rp-bar no-print">
        <Link className="lnk" to={back}>← Back to the order</Link>
        <Button onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <article className="rp" aria-label={`Receipt for order ${o.id}`}>
        <div className="rp-head">
          <div>
            <h1>{SHOP.name}</h1>
            <p>{SHOP.place}<br />{SHOP.email}<br />{SHOP.phone}</p>
          </div>
          <div className="rp-meta">
            <h2>{paid ? "Receipt" : "Order summary"}</h2>
            <p>Order {o.id}<br />{dtm(o.date)}</p>
            <span className={`rp-stamp ${state[0]}`}>{state[1]}</span>
          </div>
        </div>

        <div className="rp-two">
          <div><h3>Customer</h3><p>{o.name}<br />{o.phone}<br />{o.cEmail || o.email}</p></div>
          <div><h3>Delivery to</h3><p>{o.street}<br />{o.district}, {o.area}</p></div>
        </div>

        <table>
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Total</th></tr></thead>
          <tbody>
            {o.items.map((x) => (
              <tr key={x.id}><td>{x.n || getProduct(x.id)?.n || "Watch no longer sold"}</td><td className="num">{x.q}</td><td className="num">{fmt(x.p)}</td><td className="num">{fmt(x.p * x.q)}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="rp-sum">
          <div><span>Subtotal</span><span>{fmt(o.sub)}</span></div>
          {o.disc > 0 && <div><span>Discount {o.coupon}</span><span>−{fmt(o.disc)}</span></div>}
          <div><span>Delivery, {o.area}</span><span>{fmt(o.fee)}</span></div>
          <div className="tot"><span>Total</span><span>{fmt(o.total)}</span></div>
          {refund && <div><span>Refunded on {dt(refund.date)}</span><span>−{fmt(refund.amount)}</span></div>}
        </div>

        <div className="rp-pay">
          <h3>Payment</h3>
          <p>{o.pay}, {(o.payStatus || "Pending").toLowerCase()}{o.payRef ? `. Reference ${o.payRef}` : ""}{o.card ? `. Card ending ${o.card.last4}` : ""}</p>
        </div>

        <div className="rp-foot">Thank you for shopping with {SHOP.name}.</div>
      </article>
    </div>
  );
}
