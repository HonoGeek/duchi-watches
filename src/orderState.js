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

// ----- status changes: what is allowed, and what to ask before it happens
// moveOrder(order, newStatus, stockOf) tells the admin screen whether the move is allowed ({ ok: false, error }) or what to ask
// ({ ok: true, ask, yes }). The store checks the same rule, so a wrong move cannot slip through another way.
export const moveOrder = (o, to, stockOf = () => Infinity) => {
  const from = o.status;
  const fail = (error) => ({ ok: false, error });
  const yes = (ask, label) => ({ ok: true, ask, yes: label });
  if (from === to) return fail("The order already has this status.");
  if (from === "Delivered") {
    const recent = o.deliveredAt && Date.now() - new Date(o.deliveredAt).getTime() < 864e5;
    if (to === "Dispatched" && recent && !o.returnReq) return yes(`Move order ${o.id} back to Dispatched? It was marked delivered less than a day ago. The customer is told the status was corrected.`, "Yes, move back");
    return fail("A delivered order cannot be changed. If the customer is sending the watch back, use their return request.");
  }
  if (from === "Cancelled") {
    if (to !== "Processing") return fail("A cancelled order must be reopened first: set it to Processing.");
    if (o.refund) return fail("A refund was recorded for this order, so it cannot be reopened. Ask the customer to place a new order.");
    const short = o.items.find((x) => stockOf(x.id) < x.q);
    if (short) return fail(`Cannot reopen: only ${Math.max(0, stockOf(short.id))} of ${short.n || "a watch"} left in stock, and the order needs ${short.q}.`);
    return yes(`Reopen order ${o.id}? The watches are taken out of the stock again and the customer is told.`, "Yes, reopen order");
  }
  if (to === "Cancelled") return yes(`Cancel order ${o.id}? The watches go back into stock and the customer is told it was cancelled.${from === "Dispatched" ? " The parcel was dispatched: only cancel it if it came back." : ""}`, "Yes, cancel order");
  if (to === "Dispatched") return yes(`Mark order ${o.id} as dispatched? The customer is told it is on its way.`, "Yes, mark dispatched");
  if (to === "Delivered") return yes(`Mark order ${o.id} as delivered? The customer is invited to review it.${from === "Processing" ? " It was not marked as dispatched." : ""}`, "Yes, mark delivered");
  if (to === "Processing") return yes(`Move order ${o.id} back to Processing? The customer is told it is being prepared again.`, "Yes, move back");
  return fail("Unknown status.");
};

// Payment status changes need a look at the money first.
export const payQuestion = (o, to) => {
  const from = o.payStatus || "Pending";
  if (from === to) return null;
  const who = `${o.pay}${o.payPhone ? ` from ${o.payPhone}` : ""}${o.payRef ? `, reference ${o.payRef}` : ""}`;
  const fmtN = (n) => "RWF " + Number(n).toLocaleString("en-US");
  if (to === "Paid") return { ask: `Confirm that the payment arrived? Check that ${fmtN(o.total)} came in (${who}). The customer is told.`, yes: "Yes, payment received" };
  if (to === "Failed") return { ask: "Mark the payment as failed? The customer is told we could not confirm it and can send the details again.", yes: "Yes, mark failed" };
  return { ask: `Set the payment of order ${o.id} back to Pending? It will show as not paid again.`, yes: "Yes, set to pending" };
};
