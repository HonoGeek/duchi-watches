# DUCHI STORE (React frontend)

Watch store for Rwanda (prices in RWF). Storefront, customer dashboard and admin dashboard.

## Run
```
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # flow tests (customer + admin)
```

## Structure
```
src/
  main.jsx          entry (HashRouter + StoreProvider)
  App.jsx           layout and all routes
  store.jsx         global state: cart, user, orders, products, admin actions
  data.js           sample products, zones, coupons, staff, roles
  lib.js            helpers (money, dates, image URLs, storage)
  Videos.jsx        home page video row (4 videos)
  ui.jsx            reusable components (Button, Field, Input, Panel, Badge, ProductCard, ...)
  Layout.jsx        top bar, header, footer, toast
  styles.css        design tokens, light/dark themes, component styles
  pages/            Home, Shop, Product, Cart, Checkout, Login, Contact, Success, Account, Admin
test/flow.test.jsx  end-to-end flow tests
```

## New in this version
- **Showcase videos**: 4 videos in one row on the home page. Add the .mp4 links in Admin > Videos (empty slots show "Coming soon").
- **Review photos**: add `img` (an Unsplash id or an image URL) to a review in `data.js`. It is optional.
- **Shop filters**: grid/list view, category, price range, in-stock only, sorting, search.
- **Product specification**: Admin > Products has spec fields (movement, case size, water resistance, strap, glass) and an optional Word file (.doc/.docx, max 400 KB). The product page shows the specs and a download link.
- **Stock left** shows on the product page, in the cart and in the checkout summary.
- **Add to cart toast** names the quantity and product, e.g. "2 x Ignite Chronograph added to cart (3 in cart)".

## Admin
Open `/#/admin`. Demo staff (password `admin123`): admin@duchistore.rw, manager@duchistore.rw, staff@duchistore.rw.

## Demo data and the backend
Everything is saved in the browser (localStorage) for now. `usePersist` and the action
functions in `src/store.jsx` are the only places that touch data, so connecting the
backend later means replacing those with API calls. Passwords are not checked for
customers, and staff use a shared demo password, until real auth exists.

Photos are Unsplash stock images. Replace them with the client's product photos.

## Mobile
Layouts adapt at 900px (tablet) and 600px (phone), with extra care below 380px. On phones the
header collapses to a menu, product grids go to 2 columns, the product page gets a sticky
"Add to cart" bar, WhatsApp becomes a round button, and the admin sidebar becomes a scrolling
tab row. Check it in Chrome DevTools device mode (try 320, 375, 390, 768 and landscape).

## Content to replace before launch
- Reviews in `src/data.js` (`REVIEWS`) are SAMPLE text for the design preview. Use real customer reviews.
- The "Why choose us" rows in `src/pages/Home.jsx` are marketing claims; confirm each with the client.
- Photos, prices, contact details and social links are placeholders.

## Payments and customer contact
- **Contact details:** every order stores the customer's name, phone and email. In Admin > Orders each phone and email is a tap-to-call / tap-to-email link, and the order page has Call, WhatsApp and Email buttons.
- **MTN Mobile Money / Airtel Money:** checkout shows the merchant code, the amount, and a "Dial" button that opens the phone dialer with the USSD code filled in (`tel:` link). Edit the merchant codes and USSD strings in Admin > Payments. Confirm the exact codes with MTN and Airtel before launch.
- **Card (Stripe):** copy `.env.example` to `.env` and set `VITE_STRIPE_PUBLISHABLE_KEY` to use the real Stripe card field. Without a key a preview card form is shown. Card numbers are never saved. Charging the card needs the backend (create a PaymentIntent with the secret key).
- **Payment status:** orders start as Pending. Admin marks them Paid or Failed after checking the money arrived.
