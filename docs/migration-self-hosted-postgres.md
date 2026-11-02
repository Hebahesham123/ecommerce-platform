# Migration plan: Supabase → self-hosted PostgreSQL + Cloudflare

**Route:** the fast route. Plain PostgreSQL on a dedicated server, with **PostgREST** in front of it so
the existing `supabase-js` query code keeps working. Files move to **Cloudflare R2**.

**Estimated effort:** about 1–2 weeks of development, plus 1 week of testing in parallel before switching.

**Step-by-step to-do list:** [RUNBOOK-migration.md](RUNBOOK-migration.md). Server files are in `infra/server/`.

---

## 1. What the scan found

| Area | Size | What happens to it |
|---|---|---|
| Login (customers, couriers, admin) | Custom: `store-session.ts`, `courier-session.ts`, `phone.ts` | **Nothing.** Supabase Auth is not used. |
| Table queries (`.from(...)`) | 436 calls, 81 files, 73 tables | **Unchanged.** PostgREST speaks the same API. |
| SQL functions (`.rpc(...)`) | 16 functions, 10 files | **Unchanged.** They are plain Postgres and PostgREST serves them. |
| File storage | 5 buckets, 11 files, about 50 calls | **Rewritten** behind a small R2 helper (`src/lib/storage.ts`) |
| Live updates | 2 places | **Replaced** (see section 6) |
| Edge function `catalog-feed` | 1 | **Moved** into a Next.js route |
| Second Supabase project ("chat": WhatsApp inbox, campaigns) | 14 files, `CHAT_SUPABASE_*` env vars | **Stays on Supabase for now** (phase 2, optional) |
| SQL setup | 54 migrations, 42 functions, 62 security rules, extension `pgcrypto` | Copied with `pg_dump`; Supabase-only parts removed |

Buckets: `themes`, `entity-images`, `files`, `courier-proofs`, `live-recordings`.

The n8n workflows (`docs/n8n-*.json`) don't connect to Supabase directly, so they need no changes.

---

## 2. Target setup

```
                  ┌───────────────── Cloudflare ─────────────────┐
 Customers ──────►│ DNS + CDN + WAF ──► Vercel (Next.js, fra1)   │
                  │                          │                    │
                  │  R2 (images, files) ◄────┤                    │
                  │  media.<domain>          │ HTTPS              │
                  │                          ▼                    │
                  │            Cloudflare Tunnel (db-api.<domain>)│
                  └──────────────────────────┼────────────────────┘
                                             ▼
                     Hostinger VPS KVM 4 (Ubuntu 24.04)
                     ┌──────────────────────────────────────┐
                     │ cloudflared → Caddy → PostgREST      │
                     │                         │            │
                     │                  PostgreSQL 17       │
                     │                         │            │
                     │       WAL-G backups ───► R2 bucket    │
                     │ Garnet cache (TLS + password) ◄── Vercel│
                     └──────────────────────────────────────┘
          No inbound ports open except SSH (or SSH through the tunnel as well).
```

**Server:** a **Hostinger VPS KVM 4** (4 vCPU, 16 GB RAM, 200 GB NVMe), separate from the n8n VPS, in the
European location closest to Frankfurt. That keeps it close to Vercel `fra1`. It costs roughly $10–20/month,
depending on the term (check the renewal price).

**When to upgrade:** if CPU stays above about 70% or the database outgrows memory, move to KVM 8 (32 GB)
or a dedicated server such as Hetzner AX42 (64 GB). It's the same files; only the memory numbers in
`docker-compose.yml` change.

Everything on the server runs with **Docker Compose**, so it can be rebuilt from one file.

---

## 3. Phase 1: Prepare the server (day 1–2)

- [ ] Order the server and install Ubuntu 24.04 LTS on RAID1.
- [ ] Hardening: SSH keys only, root login off, `ufw` blocking all incoming except SSH, `fail2ban`,
      `unattended-upgrades`.
- [ ] Install Docker and the Docker Compose plugin.
- [ ] `docker-compose.yml` with four services:
  - `postgres:17`, with its data on a named volume and **no published port**
  - `postgrest/postgrest`, connected to Postgres on the internal Docker network
  - `caddy`, which serves PostgREST under the path `/rest/v1/` (supabase-js calls `<url>/rest/v1/...`)
  - `cloudflared`, a tunnel publishing Caddy at `https://db-api.<your-domain>`
- [ ] Tune Postgres for the RAM: `shared_buffers` ≈ 25% of RAM, `effective_cache_size` ≈ 70%.
- [ ] Cloudflare: lock `db-api.<domain>` to requests carrying the API key (a WAF rule), and turn caching off for it.

### Roles and keys (keeps supabase-js working)
- [ ] Create the same roles Supabase uses: `anon`, `authenticated`, `service_role` (with `BYPASSRLS`)
      and `authenticator` (the PostgREST login role).
- [ ] Generate a **new** JWT secret (64+ random characters) and give it to PostgREST.
- [ ] Use it to sign two new keys: one with `role: service_role` (server) and one with `role: anon` (browser).
      These replace `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 4. Phase 2: Copy the database (day 2–3)

Don't replay the 54 migration files. Copy the live database instead:

- [ ] `pg_dump --schema=public --no-owner --no-privileges` from Supabase (use the direct connection string).
- [ ] Restore it on the new server, then re-apply grants to `anon`, `authenticated` and `service_role`.
- [ ] Remove the Supabase-only parts. They don't exist on plain Postgres:
  - `storage.buckets` and `storage.objects` rows and policies (migrations 0002, 0003, 0038, 0040, 0048 and others)
  - `alter publication supabase_realtime ...` (migration 0034)
- [ ] Check all 16 RPC functions exist and run. For example: `place_store_order`, `order_record_payment`,
      `loyalty_award`, `loyalty_redeem`, `redeem_discount`, `complete_return_request`.
- [ ] Compare row counts for all 73 tables, Supabase against the new server.
- [ ] **New migrations from now on:** keep writing them in `supabase/migrations/`, apply them with `psql`,
      and leave out anything that touches `storage.*` or `supabase_realtime`.

---

## 5. Phase 3: Files → Cloudflare R2 (day 3–6)

- [ ] Create the R2 buckets. Public ones (`themes`, `entity-images`, `files`) are served at
      `https://media.<domain>/<bucket>/...`. Private ones (`courier-proofs`, `live-recordings`) are accessed through signed links only.
- [ ] Copy every file from Supabase Storage to R2 with `rclone`. Both speak S3.
- [ ] Write `src/lib/storage.ts`: a small wrapper on `@aws-sdk/client-s3` with the same operations the
      code uses today: `upload`, `remove`, `list`, `download`, `getPublicUrl`, `createSignedUploadUrl`.
- [ ] Switch the 11 files to the wrapper:
  - `src/app/(admin)/accounting/actions.ts`
  - `src/app/(admin)/content/files/actions.ts`
  - `src/app/(admin)/lives/broadcast.tsx`: big uploads go straight from the browser to R2 with a signed URL
  - `src/app/(admin)/online-store/themes/actions.ts`
  - `src/app/(admin)/online-store/themes/[id]/code/actions.ts`
  - `src/app/courier/actions.ts`
  - `src/app/store/account-actions.ts`
  - `src/lib/app-theme-seed.ts`
  - `src/lib/live-service.ts`
  - `src/lib/requests-service.ts`
  - `src/lib/theme-render-service.ts`
- [ ] **Rewrite saved links in the database.** Columns such as `image_url`, `cover_url`, `avatar_url`,
      `logo_url`, `proof_url` and `recording_url` hold full Supabase URLs. One SQL `update ... replace(...)` per
      column changes `https://jvjnpfaoqfeodzujsngf.supabase.co/storage/v1/object/public/` to `https://media.<domain>/`.
      Search for `supabase.co` across all text and JSON columns first, because theme settings may hold some too.
- [ ] Add `media.<domain>` to `images.remotePatterns` in `next.config.mjs`. Remove the Supabase hosts after the switch.
- [ ] Set CORS on R2 so the admin site can upload directly.

---

## 6. Phase 4: Live updates and leftovers (day 6–8)

**Admin inbox stream** (`src/app/api/inbox/stream/route.ts`) reads the **chat** Supabase project, so it is
unaffected while chat stays on Supabase. Nothing to do in this phase.

**Live-stream chat and viewer count** (`src/lib/live-chat.ts`, `broadcast.tsx`) uses Supabase Realtime
broadcast and presence through the main project. This needs no database, only a message relay. Options:
- **Recommended for now:** point it at the chat Supabase project, which keeps working. Add a
  `NEXT_PUBLIC_REALTIME_URL`/`KEY` pair so it doesn't depend on the main database URL.
- **Later:** move it to Cloudflare Durable Objects (WebSockets), with no Supabase at all.

**`catalog-feed` edge function** → `src/app/api/catalog-feed/route.ts`, a Next.js route that returns the
same CSV. Update the feed URL in Meta Commerce Manager.

---

## 7. Phase 5: Backups and monitoring (day 8–9)

- [ ] **WAL-G** to a private R2 bucket: a nightly full backup plus continuous WAL, so you can restore to any minute.
      Keep 14 days.
- [ ] Extra nightly `pg_dump` to R2, kept for 30 days. Simple and easy to restore.
- [ ] **Test a restore** on a spare machine before the switch, and then once a month.
- [ ] Monitoring: Uptime Kuma or Better Stack pinging `db-api.<domain>`; alerts for disk above 80%, high
      memory and failed backups; `pg_stat_statements` for slow queries.

---

## 7b. Phase 5b: Garnet cache for speed (day 9–11)

**Garnet** is Microsoft's free, open-source, Redis-compatible cache. It runs in the same Docker Compose
file, and the app talks to it with `ioredis`, the standard Redis client.

### What already makes the site fast (keep it)
- Anonymous storefront pages are cached at the Cloudflare/Vercel edge (`s-maxage` plus
  `stale-while-revalidate` in `src/lib/storefront-handler.ts`).
- In-process lookup memoization and versioned assets.

### Where Garnet makes it faster
| Use | Why it helps | TTL |
|---|---|---|
| **Logged-in customers' pages** | These skip the edge cache (`Vary: Cookie`), so every visit hits Postgres today. Cache the shared parts (products, collections, menus, theme settings) in Garnet. | 60 s plus clear-on-change |
| **Storefront API** (`/api/storefront/*`: recommendations, reviews, product JSON) | One Garnet read in place of several Postgres queries | 30–300 s |
| **AI search** (`/api/storefront/ai-search`) | Same search query → saved answer; avoids repeated AI calls (faster and cheaper) | 1 h |
| **OTP rate limit** (`sendOtp` in `src/app/store/actions.ts`) | **Currently missing.** Limit to 3 codes per phone per 10 min and 10 per IP per hour, to stop SMS spam and cost. | 10 min / 1 h |
| **Cart** | Fast reads of the cart on every page | 7 days |
| **Store settings, theme files** | Read on almost every request | until changed |
| **Later: live-chat realtime** | Garnet pub/sub can replace Supabase broadcast | — |

### How it is built
- [ ] Add `garnet` (image `ghcr.io/microsoft/garnet`) to `docker-compose.yml` with a strong password
      (`--auth Password`), TLS on, and memory capped (2 GB on KVM 4).
- [ ] Write `src/lib/cache.ts`, a small helper:
  - `cached(key, ttl, loader)`: read from Garnet; on a miss, run the Postgres query and save it.
  - `invalidate(tagOrPrefix)`: called by the 19 places that already run `revalidateTag`/`revalidatePath`,
    so admin edits show up immediately.
  - `rateLimit(key, max, windowSeconds)`
  - **Fails open:** if Garnet is down, it goes straight to Postgres, so the site stays up and is just slower.
- [ ] Wrap the busiest reads first (products, collections, settings, theme), then measure the improvement.
- [ ] Never cache per-customer private data (orders, addresses, loyalty balance) under a shared key.

### Connecting Vercel to Garnet
Redis-style traffic is TCP, not HTTP, and Vercel can't run a Cloudflare Tunnel client. So Garnet gets its
own port on the server, protected by **TLS plus a long password**, and the firewall opens only that port.
The round trip from Vercel `fra1` to a European Hostinger VPS is a few milliseconds up to about 15–25 ms, depending on the location, which is still much faster than several
Postgres queries.

**Fastest possible option (decide later):** run the Next.js app itself on the dedicated server in Docker,
behind Cloudflare. Postgres and Garnet are then on the same machine (under 1 ms) and nothing needs to be
exposed. The cost is giving up Vercel's previews and automatic deploys.

---

## 8. Phase 6: Test in parallel (week 2)

- [ ] Create a Vercel **preview** deployment whose env vars point at the new server and R2.
- [ ] Re-sync the data into the new server (a fresh dump) before testing.
- [ ] Smoke-test checklist:
  - [ ] Storefront: home, collection, product, search, cart, recommendations
  - [ ] Phone login (OTP) and the account page, including avatar upload
  - [ ] Place a COD order and a Paymob order, including the webhook updating payment
  - [ ] Discounts apply and are counted (`redeem_discount`)
  - [ ] Loyalty: points awarded, vault opened, reward redeemed
  - [ ] Admin: order detail, fulfill and unfulfill, restock, returns
  - [ ] Courier: assign, portal edit, proof photo upload, admin confirm, accounting
  - [ ] Themes: render, code edit, file upload
  - [ ] Blog and SEO pages, plus sitemap
  - [ ] Live: start a broadcast, chat, viewer count, recording upload
  - [ ] Order relay to n8n still fires
- [ ] Load test the busiest pages (for example with `k6`) to confirm speed is at least as good as before.

---

## 9. Phase 7: Switch over (one evening, about 1 hour)

1. Choose a low-traffic time and announce a short maintenance window.
2. Put the store in maintenance mode, or pause checkout.
3. Take the final `pg_dump` from Supabase, restore it, and run the URL rewrite SQL.
4. Run a final `rclone sync` of the storage files.
5. In Vercel production, set:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://db-api.<domain>`
   - `SUPABASE_SERVICE_ROLE_KEY` = the new service key
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the new anon key
   - the R2 keys, bucket names and `media` domain
6. Redeploy, run the smoke-test checklist on production, and turn checkout back on.

**Rollback:** leave the Supabase project untouched (paused, not deleted) for 2–4 weeks. If something
breaks in the first hours, set the old env vars back and redeploy. Orders placed on the new server since the
switch must be copied back, so do this only if the problem is serious.

---

## 10. Phase 8 (optional, later)

- Move the **chat** Supabase project (WhatsApp inbox, campaigns) to the same server. The inbox stream
  would then use Postgres `LISTEN/NOTIFY` in place of Supabase Realtime.
- Move live-stream chat to Cloudflare Durable Objects.
- Replace `supabase-js` with **Drizzle**, a few files at a time, to remove PostgREST. This is not required.
- Add a second "replica" server for read traffic and failover once traffic grows.

---

## 11. Monthly cost (estimate)

| Item | Cost |
|---|---|
| Hostinger VPS KVM 4 (later: KVM 8 or a Hetzner dedicated server, €45–60) | $10–20 |
| Cloudflare R2 (storage at $0.015/GB, no egress fees) | $1–10 depending on files and recordings |
| Cloudflare Tunnel, DNS, CDN, WAF (free plan) | $0 |
| Chat Supabase project (stays as is) | your current plan |
| Vercel | unchanged |

## 12. Risks to watch

- **You own the database now.** Backups, updates and disk space are your responsibility, so set up alerts from day one.
- **Missed storage links.** A product image with an old Supabase URL breaks once Supabase is shut down.
  Search the whole database for `supabase.co` before deleting the old project.
- **New migrations** must not use Supabase-only features (`storage.*`, `supabase_realtime`, `auth.*`).
- **Keep the JWT secret and service key safe.** The service key bypasses all security rules, the same as today.
