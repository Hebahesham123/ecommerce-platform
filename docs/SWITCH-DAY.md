# Switch day: move the LIVE store's database to the server

Takes about 30–45 minutes. Do it at a **quiet time** (late night). For about 2–3 minutes a new order or a
login code could land in the old place, so quiet matters.

👤 = you · 🤖 = Claude

## Before (any day before)

- [ ] 👤 Supabase → **Reset database password** (the old one appeared in chat). Then run:
      `ssh -t deploy@72.60.135.114 /opt/store/scripts/save-supabase-uri.sh` and paste the **new** password.
- [ ] 👤 n8n → **Credentials → Add credential → "Supabase API"**, name it **`Self-hosted DB`**:
  - Host: `https://srv2120209.hstgr.cloud`
  - Service Role Secret: the `DATABASE_API_KEY` value (from `.env.vercel-preview.local`, or
    `ssh deploy@72.60.135.114 cat /opt/store/vercel-keys.txt`)
  - Save. **Don't** use it anywhere yet.
- [ ] 🤖 Confirm `main` on GitHub hasn't changed since the branch was built (otherwise re-base it first).

## On the day (in this order)

1. [ ] 👤 Hostinger → VPS → **Snapshots & Backups → Create snapshot** (a free restore point).
2. [ ] 🤖 Fresh copy of the data: wipe the test copy → dump Supabase → restore → `02-after-restore.sql`
       → rate-limit migration `0061` → compare **every table's row count** with Supabase (must match).
3. [ ] 🤖 Vercel → add **`DATABASE_API_URL=https://srv2120209.hstgr.cloud`** for **Production**
       (`DATABASE_API_KEY` is already there for Production).
4. [ ] 🤖 Put the branch live: fast-forward `main` to `migrate/self-hosted-db` → Vercel builds Production (~2 min).
5. [ ] 👤 **As soon as it's live**, in n8n workflow **"OTP by choice – same code on WhatsApp & SMS"**:
       open **"Create OTP row3"** → Credential: choose **`Self-hosted DB`** → table stays `otp_codes` → **Save**.
6. [ ] 🤖 Test the live site: storefront, product page, admin orders, and the server's query log shows traffic.
7. [ ] 👤 Real test: log in with your phone (WhatsApp code), then place one **COD** order.
       🤖 confirms the order is in the new database and reached the supplier relay.
8. [ ] 🤖 Run a backup by hand: `/opt/store/scripts/backup.sh`.

## If something goes wrong (undo, about 3 minutes)

1. Vercel → **delete `DATABASE_API_URL` from Production** → redeploy Production.
2. n8n → "Create OTP row3" → switch the credential back to the old Supabase one → Save.
3. The store is back on Supabase. Any orders placed on the new server in between must be copied back by hand
   (🤖 can list them).

## After (when everything has run fine for 1–2 weeks)

- Files, live-chat realtime and the WhatsApp/analytics project still use Supabase. They move in their own steps.
- Then pause, and later delete, the Supabase projects.
