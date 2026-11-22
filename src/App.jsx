import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Topbar, Header, Footer, Toast, WhatsApp } from "./Layout";
import { useStore } from "./store";
import { ReviewNudge } from "./ReviewDialog";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Contact from "./pages/Contact";
import Help, { Legal } from "./pages/Help";
import Success from "./pages/Success";
import Receipt from "./pages/Receipt";
import Account, { Overview, Orders, OrderDetail, Notifications, Wishlist, Addresses, Profile } from "./pages/Account";
import Admin, { Dashboard, AdminOrders, AdminOrderDetail, AdminProducts, Categories, ReviewsAdmin, Settings, Videos as AdminVideos, Coupons, Shipping, Payments, Team, Audit, Messages as AdminMessages, Subscribers, Policies } from "./pages/Admin";

export default function App() {
  const { pathname, hash } = useLocation();
  const { user } = useStore();
  const admin = pathname.startsWith("/admin");
  // The admin area and the signed-in customer dashboard have their own layout, so the shop header and footer are hidden there.
  const dash = admin || (pathname.startsWith("/account") && !!user) || pathname.startsWith("/receipt"); // the receipt is a plain printable page
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- pages with a #section scroll themselves
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
        const p = document.getElementById("prog");
        if (p) p.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
        const im = document.querySelector(".hero > img");
        if (im && y < 900) im.style.translate = `0 ${y * 0.25}px`;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    on();
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [pathname]);
  useEffect(() => {
    const s = pathname.split("/")[1];
    document.title = (s ? s[0].toUpperCase() + s.slice(1) : "Watches in Rwanda") + " | DUCHI STORE";
  }, [pathname]);

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      {!dash && <><div className="prog" id="prog" /><Topbar /><Header /></>}
      <main id="main" tabIndex={-1} key={pathname} className="fd">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/login" element={<Login />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help" element={<Help />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/success/:id" element={<Success />} />
          <Route path="/receipt/:id" element={<Receipt />} />
          <Route path="/account" element={<Account />}>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/admin" element={<Admin />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<Categories />} />
            <Route path="videos" element={<AdminVideos />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="shipping" element={<Shipping />} />
            <Route path="payments" element={<Payments />} />
            <Route path="team" element={<Team />} />
            <Route path="audit" element={<Audit />} />
            <Route path="reviews" element={<ReviewsAdmin />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="subscribers" element={<Subscribers />} />
            <Route path="policies" element={<Policies />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!dash && <><Footer /><WhatsApp /></>}
      {!dash && <ReviewNudge />}
      <Toast />
    </>
  );
}
