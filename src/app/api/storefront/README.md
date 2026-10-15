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

### The app's theme

The website's look is an uploaded Liquid theme — files, sections, CSS — which
an app cannot use: it draws its own screens and needs telling what to draw. So
the app has a theme of its own, edited in the dashboard under **App → App
theme**, and it is data rather than markup: a brand (name, logo, accent
colour, announcement bar) and an ordered list of typed home-screen blocks.

`/home` fetches exactly what those blocks need and nothing else, so a store
whose home is one banner and one collection does not pay for six rows of
products it never shows. Products come back keyed by collection handle, so two
blocks pointing at the same collection cost one copy.

Every block type has to exist as a screen in the app. A theme that can express
more than the app can draw is a promise the app will break.

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
| POST | `/auth/request-code` | Without `channel`: check the number (`already_verified` \| `needs_code`), nothing sent. With `channel` (`whatsapp` \| `sms`): send it (`sent` \| `not_delivered`) |
| POST | `/auth/verify` | Check the code, return a token |
| POST | `/auth/login` | Sign in a number we already know, return a token |
| GET | `/me` | Profile and order history |
| GET | `/recommendations` | Complete your look: products that go with the shopper’s past orders, from the theme’s pairing rules. Guests and first-time shoppers get an empty list |
| GET | `/home` | The front page in one request: the theme, its blocks' data, menus, collections |
| GET | `/theme` | How the app should look and what its home screen is made of |
| GET | `/products` | Catalogue cards — `?q=`, `?collection=`, `?category=`, `?inStock=1`, `?limit=`, `?offset=` |
| GET | `/products/{id}` | One full product, by variant id **or** website handle |
| GET | `/collections` | The merchant's published collections, in their order |
| GET | `/collections/{handle}` | One collection's products — `?sort=`, `?limit=`, `?offset=`; `all` means the whole shop; `?vendor=a,b`, `?minPrice=`, `?maxPrice=`, `?inStock=1`, `?onSale=1` filter before paging; the reply carries `facets` (brands with counts, price span) |
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

### Notifications

Messages written in the dashboard under **App → Notifications** reach an
install twice: in the bell inside the app, and as a pop-up on the phone if the
phone allowed them. An install is its visitor id (the `x-visitor` header), so a
guest has a bell too; signing in ties the install to the customer, which is how
"customers who ordered" or a list of phone numbers can be reached.

Pop-ups go out through **Firebase Cloud Messaging** to a phone that registered a
Firebase token, using the service-account key in `FIREBASE_SERVICE_ACCOUNT`
(Firebase → Project settings → Service accounts → Generate new private key;
the JSON as it is, or base64'd). A phone that registered an Expo token
(`ExponentPushToken[…]`) goes through Expo's push service instead; set
`EXPO_ACCESS_TOKEN` only if "enhanced push security" is on for that project.

A pop-up's `data` carries `notificationId` and `link` — the same shape the
app's tiles use (`productId` | `handle` | `url` | `screen`, or empty for the
bell). Through Firebase, data values are strings, so `link` arrives as JSON
text. Tapping one should post `/notifications/{id}/open`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/notifications/device` | This install is here — on every launch, after sign-in, and when pop-ups are allowed or refused. `{ pushToken?, pushEnabled, platform }`; the phone comes from the bearer token |
| GET | `/notifications` | The bell: `{ items: [{ id, title, body, imageUrl, link, sentAt, read }], unread }`, newest first; `?limit=` up to 100 |
| POST | `/notifications/read` | `{ ids: [...] }` marks those read, `{}` marks everything (opening the bell); answers `{ unread }` |
| POST | `/notifications/{id}/open` | A notification was tapped; counted once per install |
