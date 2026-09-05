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

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/request-code` | Send a WhatsApp/SMS code |
| POST | `/auth/verify` | Check the code, return a token |
| POST | `/auth/login` | Sign in a number we already know, return a token |
| GET | `/me` | Profile and order history |
| GET | `/products` | Catalogue, with `?q=` and `?category=` |
| GET | `/products/{id}` | One product with its variants |
| GET | `/collections` | Categories with product counts |
| POST | `/cart/price` | Re-price a device-held cart against live stock |
| POST | `/discount` | Preview a coupon |
| POST | `/orders` | Place a COD order (signed in; the order's phone must be the token's) |
| GET | `/orders` | The shopper's own orders |
| GET | `/orders/{number}` | One of the shopper's own orders, with lines |
| GET | `/returns/eligible` | Orders still inside the return window |
| POST | `/returns` | Open a return or exchange |
| GET | `/returns` | The shopper's own requests |
| POST | `/requests` | A general enquiry (multipart, with attachments) |
