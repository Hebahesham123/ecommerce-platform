# Storefront API

The JSON surface the mobile app talks to.

The website does not use it: its pages are React Server Components calling
Server Actions, which only work from a browser that Next.js rendered. An app
has no such browser, so it needs an ordinary HTTP API — but it must not become
a *second implementation* of the store, or the two surfaces drift and the app
sells stock the website has already promised away.

So every route here is thin. Each one authenticates the caller, notes which
channel is asking, and hands off to the exact same server function the website
calls. Pricing, the stock reservation, the 14-day return window and the ad
attribution all live in `src/lib` and are shared.

## Conventions

- Responses are always `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`.
- Nothing is cached: every route returns a shopper's own data or live stock.
- **Auth** is `Authorization: Bearer <token>`, issued by `/auth/verify` or
  `/auth/login`. The token carries exactly the same claim as the website's
  session cookie — "this request belongs to this phone number" — and expires on
  the same 30-day clock. Note that `/auth/login` inherits the website's
  passwordless rule: a number the store already knows signs in without a code.
  That is the store's chosen login model, not something the token strengthens.
- **Channel** is the `x-store-channel: app | web` header, defaulting to `app`.
  It is attribution only: it decides the label on the row and which Meta
  dataset a purchase reports to. Nothing grants access based on it.

## Routes

### Merchandising

These read the same catalogue resolver the website renders from, so the app
sees the merchant's real collections and menus — their handles, images, order
and publish state — rather than a guess assembled from product fields.

Two shapes of product. A **card** (id, handle, name, image, price, stock) is
what listings return; the **full product**, with every variant and image, is at
`/products/{id}`. A forty-product grid does not need four hundred variants, and
on mobile data the difference is most of the payload.

Prices are whole pounds everywhere. The catalogue speaks minor units internally
because Liquid needs them; the conversion happens once, in `lib/api/catalog.ts`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/request-code` | Send a WhatsApp/SMS code |
| POST | `/auth/verify` | Check the code, return a token |
| POST | `/auth/login` | Sign in a number we already know, return a token |
| GET | `/me` | Profile and order history |
| GET | `/home` | The front page in one request: menus, collections, rows, new arrivals |
| GET | `/products` | Catalogue cards — `?q=`, `?collection=`, `?category=`, `?inStock=1`, `?limit=`, `?offset=` |
| GET | `/products/{id}` | One full product, by variant id **or** website handle |
| GET | `/collections` | The merchant's published collections, in their order |
| GET | `/collections/{handle}` | One collection's products — `?sort=`, `?limit=`, `?offset=`; `all` means the whole shop |
| GET | `/menus` | Every navigation menu, items carrying a typed target |
| GET | `/menus/{handle}` | One menu — usually `main-menu` or `footer` |
| GET | `/reviews` | Published reviews; `?featured=1` is the Happy Customers set |
| POST | `/reviews` | Leave a review — lands pending, like every other |
| POST | `/cart/price` | Re-price a device-held cart against live stock |
| POST | `/discount` | Preview a coupon |
| POST | `/orders` | Place a COD order (signed in; the order's phone must be the token's) |
| GET | `/orders` | The shopper's own orders |
| GET | `/orders/{number}` | One of the shopper's own orders, with lines |
| GET | `/returns/eligible` | Orders still inside the return window |
| POST | `/returns` | Open a return or exchange |
| GET | `/returns` | The shopper's own requests |
| POST | `/requests` | A general enquiry (multipart, with attachments) |
