# Order Relay → Supplier Shopify (manual-payment / dropship flow)

When a customer places an order on **our** store, we forward it to n8n. n8n
creates a **draft order** on the **supplier Shopify** store and emails the
customer a **checkout link** to pay there.

```
Customer orders on our store (manual payment)
      │  placeOrder() → POST /webhook/order-relay
      ▼
n8n: Prepare draft ──► Create Shopify draft order ──► Email checkout link
      │  (per item: exact supplier variant OR brand-stripped title search)
      ▼
Customer receives Shopify invoice email → pays on supplier checkout
```

## 1. Database

Run the migration `supabase/migrations/0013_supplier_mapping.sql`. It adds three
columns to `inventory_items`:

| column                | purpose                                                        |
| --------------------- | ------------------------------------------------------------- |
| `supplier_variant_id` | exact supplier Shopify variant → used directly (best match)   |
| `supplier_url`        | supplier product page (reference)                             |
| `supplier_title`      | optional override for the search term                         |

```bash
supabase db push
```

## 2. Product mapping (in the admin)

Open **Inventory → edit a product → "Supplier mapping"** and fill any of:

- **Supplier variant ID** — most reliable. Paste the supplier's Shopify variant
  id. The relay uses it as-is, no guessing. Leave empty to match by title.
- **Supplier product URL** — the supplier product page (reference only).
- **Search term override** — force a specific search phrase (e.g. `gold watch`).

Matching order used per item (the "Both" strategy):

1. `supplier_variant_id` set → use it (exact).
2. else `supplier_title` set → search the supplier store for that phrase.
3. else → strip the item's **vendor/brand** + common brand words from the
   product name and search (e.g. `Rolex Gold Watch` → `gold watch`).

## 3. App → n8n webhook

`placeOrder()` POSTs to `ORDER_RELAY_WEBHOOK_URL` after every order. Default:
`https://n8n.srv1155688.hstgr.cloud/webhook/order-relay`. Override via env:

```env
ORDER_RELAY_WEBHOOK_URL=https://<your-n8n>/webhook/order-relay
```

Payload shape:

```json
{
  "orderNumber": "BB12345678",
  "total": 1200,
  "customer": { "name": "…", "phone": "+20…", "email": "…", "governorate": "…", "city": "…", "address": "…", "note": "…" },
  "items": [
    { "title": "Rolex Gold Watch", "variantTitle": null, "sku": "…", "quantity": 1, "price": 1200,
      "vendor": "Rolex", "supplierVariantId": null, "supplierUrl": null, "supplierTitle": null }
  ]
}
```

> The customer **email** is required for the checkout-link email. Collect it at
> checkout (add an email field to the checkout form) or on the customer profile;
> `placeOrder` also falls back to the saved profile email.

## 4. Import & configure the n8n workflow

1. In n8n: **Workflows → Import from File →** `docs/n8n-order-relay.workflow.json`.
2. Add two environment variables to your n8n instance (or replace the header
   expressions with a Header-Auth credential):
   - `SHOPIFY_STORE` = `your-supplier.myshopify.com`
   - `SHOPIFY_TOKEN` = `shpat_…` (a **custom app** Admin API token on the
     supplier store, scopes: `write_draft_orders`, `read_products`).
3. Open the **Prepare draft** node and extend `BRAND_STOPWORDS` with the brand
   names you carry (the item's own `vendor` is always stripped automatically).
4. **Activate** the workflow. The production webhook URL becomes
   `https://<your-n8n>/webhook/order-relay` — make sure it matches
   `ORDER_RELAY_WEBHOOK_URL`.

### What each node does

| node                 | role                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| Webhook (order-relay)| receives the order                                                   |
| Prepare draft        | resolves each item to a supplier variant, builds the draft body      |
| Has line items?      | if nothing matched → responds `422 no_supplier_match`                 |
| Create draft order   | `POST /admin/api/2024-10/draft_orders.json`                          |
| Has email?           | only emails when we have the customer's email                        |
| Email checkout link  | `POST /draft_orders/{id}/send_invoice.json` (Shopify sends the email)|
| Respond OK           | returns `invoiceUrl`, `draftOrderId`, and match report               |

The response includes `matches` (what each item mapped to and whether by exact
id or search) and `unmatched` (items no supplier product was found for) — useful
for monitoring which products still need a mapping.

## 5. Test

```bash
curl -X POST https://<your-n8n>/webhook/order-relay \
  -H 'content-type: application/json' \
  -d '{"orderNumber":"TEST1","customer":{"name":"Test User","email":"you@example.com","phone":"+201000000000","address":"1 St","city":"Cairo","governorate":"Cairo"},"items":[{"title":"Rolex Gold Watch","vendor":"Rolex","quantity":1}]}'
```

Expected: a draft order appears on the supplier Shopify store and (if an email
was given) the customer receives the Shopify invoice with a checkout link.
