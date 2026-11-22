// Shared rules about money and stock on an order, used by the admin list, the dashboard, the bell and the order page.
export const isPaid = (o) => (o.payStatus || "Pending") === "Paid";
export const isMomo = (o) => o.pay === "MTN Mobile Money" || o.pay === "Airtel Money";
// The refund recorded for an order: after a cancellation (o.refund) or after a return (o.returnReq.refund).
export const refundOf = (o) => o.refund?.amount || o.returnReq?.refund?.amount || 0;
// A cancelled order whose money may need to go back to the customer, and nothing is recorded yet:
// it was paid, or the customer cancelled by themselves after paying by mobile money that was not confirmed yet.
export const refundDue = (o) => o.status === "Cancelled" && !o.refund && o.refundCheck !== "none" && (o.refundCheck === "check" || isPaid(o));
// An approved return where nobody decided yet whether the watch goes back on sale.
export const restockDue = (o) => !!o.returnReq && ["approved", "refunded"].includes(o.returnReq.status) && !o.returnReq.restock;
// What is waiting for the admin on this order, as short labels.
export const openItems = (o) => [
  o.cancelReq?.status === "pending" && "Cancel request",
  o.returnReq?.status === "pending" && "Return request",
  refundDue(o) && (o.refundCheck === "check" ? "Check payment" : "Refund due"),
  restockDue(o) && "Restock decision",
].filter(Boolean);
export const hasReq = (o) => openItems(o).length > 0;
