import { Link } from "react-router-dom";
import { useStore } from "../store";
import { Img, Button, Empty, Panel, Qty, StockLeft } from "../ui";
import { fmt } from "../lib";

export default function Cart() {
  const { cart, products, subtotal, user, changeQty, removeFromCart } = useStore();
  return (
    <section style={{ paddingTop: 56 }}><div className="wrap">
      <h1 className="h2" style={{ marginBottom: 32 }}>Your cart</h1>
      {!cart.length ? <Empty text="Your cart is empty. Add a watch to get started." /> : (
        <div className="cols">
          <div>
            {cart.map((x) => {
              const p = products[x.id];
              return (
                <div className="line" key={x.id}>
                  <div className="t"><Img id={p.im[0]} alt={p.n} w={200} /></div>
                  <div>
                    <Link to={`/product/${p.id}`}><b style={{ fontWeight: 500 }}>{p.n}</b></Link>
                    <div className="mute sm">{p.s}</div>
                    <StockLeft p={p} q={x.q} />
                    <div className="row" style={{ marginTop: 10 }}>
                      <Qty value={x.q} onMinus={() => changeQty(x.id, -1)} onPlus={() => changeQty(x.id, 1)} />
                      <Button variant="o" size="s" onClick={() => removeFromCart(x.id)}>Remove</Button>
                    </div>
                  </div>
                  <div className="price">{fmt(p.p * x.q)}</div>
                </div>
              );
            })}
          </div>
          <Panel className="sum">
            <h2 className="h3" style={{ marginBottom: 12 }}>Summary</h2>
            <div className="r"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="r mute"><span>Delivery</span><span>At checkout</span></div>
            <div className="r tot"><span>Total</span><span>{fmt(subtotal)}</span></div>
            <Button variant="g" block to="/checkout" style={{ marginTop: 16 }}>Checkout</Button>
            <p className="sm mute" style={{ marginTop: 12, textAlign: "center" }}>
              {user ? `Signed in as ${user.email}` : "You will sign in at checkout to pay."}
            </p>
          </Panel>
        </div>
      )}
    </div></section>
  );
}
