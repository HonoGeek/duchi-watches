import { Navigate, useLocation } from "react-router-dom";
import { Button } from "../ui";

export default function Success() {
  const id = useLocation().state?.id;
  if (!id) return <Navigate to="/" replace />;
  return (
    <div className="wrap ok">
      <h1 className="h2">Thank you, order received.</h1>
      <p className="lead" style={{ margin: "16px auto 28px" }}>Order {id}. We will call you to confirm delivery.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Button to={`/account/orders/${id}`}>View my order</Button>
        <Button to="/shop" variant="o">Continue shopping</Button>
      </div>
    </div>
  );
}
