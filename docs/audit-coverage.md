# Audit coverage — the dangerous actions

Security plan step 3.4. Every action on this list writes a row to
`admin_audit` (migration 0065): who, what, when, before and after.

**Definition of done for any PR that adds or touches one of these:** the
action is on this table with a ✅, its audit row is written **in the same
transaction as the change**, and personal data in it is masked.

| # | Action | Code | Audited | Atomic |
|---|---|---|---|---|
| 1 | Edit an order's contents or discount | `editOrder` → `order_edit` | ✅ | ✅ in the function (0066) |
| 2 | Edit a customer's details on an order | `updateOrderCustomer` | ✅ masked | ⚠️ after the change — moves no money |
| 3 | Refund a payment | `refundPayment` | ❌ | — |
| 4 | Record a payment | `collectPayment` | ❌ | — |
| 5 | Mark an order paid | `markOrderPaid` | ❌ | — |
| 6 | Cancel an order | `cancelOrder` | ❌ | — |
| 7 | Restock an order | `restockOrder` | ❌ | — |
| 8 | Create or change a discount | `createDiscount` / `updateDiscount` | ❌ | — |
| 9 | Issue or redeem a gift card | not built yet | ❌ | — |
| 10 | Complete a return or exchange | `complete_return_request` | ❌ | — |

## Why atomic matters

The audit was first written by the app *after* the change had been saved.
With `AUDIT_ENFORCE=true` that is actively dangerous: a failed audit write
returns an error for a change that already happened, the merchant presses
again, and the refund goes out twice. An audit that turns one refund into two
is worse than no audit.

So for anything that moves money the row is inserted **inside the same
database function as the change** — both land or neither does, and pressing
again after an error is the right thing to do. `order_edit` is the worked
example (migration 0066); the same shape applies to refunds and gift cards.

Actions that move no money may write the row afterwards, marked ⚠️ above. The
worst case there is a change with no record, not a change applied twice.

## `AUDIT_ENFORCE`

Stays **off** until every money-moving action in this table is ✅ atomic.
Turning it on earlier converts a silent gap into a double-spend.

Flip it in both places at once — the dashboard runs on the server and on
Vercel:

```bash
echo 'AUDIT_ENFORCE=true' >> /opt/store/web.env
cd /opt/store && docker compose up -d --no-deps web
```

Vercel → Settings → Environment Variables → `AUDIT_ENFORCE=true` (Production)
→ redeploy.

## Personal data

`admin_audit` is append-only, so nothing written there can be removed. A
customer may ask for their data to be erased (Egypt law 151/2020), and a
table nobody can delete from cannot honour that. So the audit stores **which
fields changed** and a mask — `•••932` for a phone, `h•••@gmail.com` for an
email, `22 chars` for an address — never the value. See `src/lib/mask.ts`;
an unknown field falls back to keeping nothing but a length.

The readable before and after still exist on the order's **timeline**
(`order_events`), which is where the merchant needs to see them, and that is
an ordinary table that can be erased on request.
