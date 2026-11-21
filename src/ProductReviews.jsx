import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "./store";
import { Button, Img, Pager, Select, Stars, usePaged } from "./ui";
import ReviewDialog from "./ReviewDialog";
import { dt } from "./lib";

const PAGE = 5; // reviews per page

// The reviews of one product, with the rating summary and (for people who received it) the "write a review" button.
export default function ProductReviews({ p }) {
  const { reviews, published, user, eligible, allOrders, deleteReview, ask } = useStore();
  const [sort, setSort] = useState("new");
  const [dlg, setDlg] = useState(null);

  const list = published.filter((r) => r.pid === p.id);
  const shown = [...list].sort((a, b) => (sort === "high" ? b.r - a.r : sort === "low" ? a.r - b.r : 0) || new Date(b.date) - new Date(a.date));
  const pg = usePaged(shown, PAGE, sort);
  const avg = list.length ? list.reduce((a, r) => a + r.r, 0) / list.length : 0;
  const count = (n) => list.filter((r) => r.r === n).length;

  const todo = eligible.find((e) => e.pid === p.id);
  const mine = user ? reviews.find((r) => r.pid === p.id && r.email === user.email) : null;
  const onTheWay = user && allOrders.find((o) => o.email === user.email && !["Delivered", "Cancelled"].includes(o.status) && o.items.some((i) => i.id === p.id));

  let cta;
  if (todo) cta = <><Button onClick={() => setDlg({ item: todo })}>Write a review</Button><span className="mute sm">You received this watch in order {todo.orderId}.</span></>;
  else if (mine) cta = <span className="mute sm">You reviewed this watch{mine.status !== "published" ? ` (${mine.status === "pending" ? "waiting for approval" : "hidden"})` : ""}.</span>;
  else if (onTheWay) cta = <span className="mute sm">Your order {onTheWay.id} is on its way. We will invite you to review this watch once it arrives.</span>;
  else if (!user) cta = <span className="mute sm">Bought this watch? <Link to="/login" className="lnk">Sign in</Link> after delivery to share your review.</span>;
  else cta = <span className="mute sm">Reviews can be written by customers who received this watch.</span>;

  return (
    <section className="alt" id="reviews"><div className="wrap">
      <div className="head" style={{ alignItems: "flex-end" }}>
        <div><h2 className="h2">Reviews</h2><div className="rsum-cta">{cta}</div></div>
        {list.length > 1 && (
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort reviews" className="rsort">
            <option value="new">Newest first</option><option value="high">Highest rated</option><option value="low">Lowest rated</option>
          </Select>
        )}
      </div>

      {list.length ? (
        <div className="rsplit">
          <div className="rsum">
            <div className="rsum-n">{avg.toFixed(1)}</div>
            <Stars n={Math.round(avg)} />
            <p className="mute sm">Based on {list.length} {list.length === 1 ? "review" : "reviews"}</p>
            <div className="rbars">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n}><span>{n}</span><div><i style={{ width: `${(count(n) / list.length) * 100}%` }} /></div><em>{count(n)}</em></div>
              ))}
            </div>
          </div>
          <div className="rlist">
            {pg.items.map((r) => (
              <article className="rrow" key={r.id}>
                <div className="rrow-h"><Stars n={r.r} /><span className="mute sm">{dt(r.date)}</span></div>
                <p>{r.t}</p>
                {r.img && <div className="rrow-img"><Img id={r.img} alt={`Photo from ${r.n}`} w={500} /></div>}
                <div className="rrow-f">
                  <div className="av">{r.n[0]}</div>
                  <b>{r.n}</b>
                  {r.verified && <span className="rw-vb">Verified buyer</span>}
                  {user && r.email === user.email && (
                    <span className="rrow-own">
                      <button type="button" className="lnk" onClick={() => setDlg({ existing: r })}>Edit</button>
                      <button type="button" className="lnk mute" onClick={() => ask("Delete your review?", () => deleteReview(r.id), { yes: "Yes, delete" })}>Delete</button>
                    </span>
                  )}
                </div>
                {r.reply && <div className="rrep"><b>DUCHI replied</b><p>{r.reply}</p></div>}
              </article>
            ))}
            <Pager {...pg} onPage={pg.setPage} noun="reviews" />
          </div>
        </div>
      ) : (
        <div className="rempty"><p>No reviews yet.</p><span className="mute sm">Customers can review this watch once their order has been delivered.</span></div>
      )}
      {dlg && <ReviewDialog {...dlg} onClose={() => setDlg(null)} />}
    </div></section>
  );
}
