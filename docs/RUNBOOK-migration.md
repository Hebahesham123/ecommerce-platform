# Runbook: move the store to your own server, step by step

The reasons and design are in [migration-self-hosted-postgres.md](migration-self-hosted-postgres.md).
This file is the **to-do list**: do the steps in order and tick them off.

- 👤 **You**: accounts, payments, typing commands on the server, entering secrets.
- 🤖 **Claude**: code changes in this project.

**Never paste passwords, keys or tokens into the chat.** Put them straight into the server's `.env`
file or into Vercel.

Files used below:
- `infra/server/`: `docker-compose.yml`, `.env.example`, `Caddyfile`, `sql/`, `scripts/`
- `scripts/make-jwt-keys.mjs`

---

## Progress (2026-11-02)

- ✅ A1, A2: Hostinger KVM 4 bought: Frankfurt, Ubuntu 24.04, IP `72.60.135.114`, with this PC's SSH key.
- ✅ B1–B6: server hardened, Docker installed, `/opt/store` set up, secrets generated on the server,
  Postgres + PostgREST + Caddy running, roles created, API tested (service key works; public, missing
  and forged keys are refused).
  - The two Vercel keys are in `/opt/store/vercel-keys.txt` on the server (readable by `deploy` only).
- ✅ **No own domain yet → direct mode:** the API is live at **`https://srv2120209.hstgr.cloud`**, with a free
  automatic HTTPS certificate from Caddy (`DB_API_HOST` in `.env`) and ports 80/443 open. Tested from the
  internet: health ok, http → https redirect, API description hidden, forged keys refused, Postgres port closed.
  - In Vercel, `NEXT_PUBLIC_SUPABASE_URL` will be `https://srv2120209.hstgr.cloud`.
  - **Images stay on Supabase Storage for now** (`STORAGE_DRIVER=supabase`). They move to R2 once there's a domain.
  - No Cloudflare in front of the database for now. The API keys still protect all data.
- ⏳ B8 (nightly backups): needs a backup destination. R2 works without a domain; it only needs a Cloudflare account.
- ✅ **Part C (test copy), 2026-11-02:** Supabase project "Ecommerce saas" (`jvjnpfaoqfeodzujsngf`, PG 17.6, 33 MB)
  was copied. All 84 tables match exactly (16,815 rows), and 45 functions, 36 triggers and 89 policies were restored.
  The API was tested with real data, joins, functions and the 1000-row cap.
  - The connection info is saved privately on the server as `/opt/store/supa.uri`. Enter it with
    `ssh -t deploy@72.60.135.114 /opt/store/scripts/save-supabase-uri.sh` (it accepts just the database password).
  - ⚠️ The Supabase DB password was pasted in chat on 2026-11-02, so reset it, then re-run the helper.
  - The `uuid-ossp` extension was added (now in `01-roles.sql`).
  - Gotcha: in scripts piped over `ssh 'bash -s'`, give `docker compose exec -T` a `</dev/null`, or it eats the rest of the script.
- ✅ **D2 + D4 (code), 2026-11-02:** all file storage goes through `src/lib/storage.ts`, which has its own
  Supabase connection (`STORAGE_SUPABASE_URL` / `STORAGE_SUPABASE_SERVICE_ROLE_KEY`), so files stay on
  Supabase while the database moves. Live-chat realtime has its own settings
  (`NEXT_PUBLIC_REALTIME_SUPABASE_URL` / `_ANON_KEY`). Both fall back to the old settings, so nothing changes
  until they're set.
- ✅ **Local test against the new server (2026-11-02):** with `.env.development.local` (git-ignored), the storefront,
  12 store pages, 26 admin pages, the order list (29 orders), order detail, and theme file list/read all work.
  The queries were confirmed arriving at the new server. Supplier relay and OTP webhooks were pointed at a dead address for the test.
  - The local preview needs `node --use-system-ca` (launch config `dev-system-ca`), because this PC's network
    filter breaks Node's HTTPS (Google Fonts too, not just the server).
- ⏳ **Part F on Vercel (Preview environment only):** set
  `NEXT_PUBLIC_SUPABASE_URL=https://srv2120209.hstgr.cloud`, plus `SUPABASE_SERVICE_ROLE_KEY` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `/opt/store/vercel-keys.txt`. Also set `STORAGE_SUPABASE_URL`,
  `STORAGE_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_REALTIME_SUPABASE_URL` and `NEXT_PUBLIC_REALTIME_SUPABASE_ANON_KEY`
  to the CURRENT Supabase values.
- ⏳ D3, D5–D7, E, G. This copy is a **test copy**: Supabase is still live, so it goes stale. Re-copy on switch-over day (Part G).
- **Later, with a domain:** do A3 → set `DB_API_HOST=` (empty), add the tunnel token, run
  `docker compose --profile tunnel up -d`, remove the 80/443 ports, and switch Vercel to `https://db-api.<domain>`.

Log in with: `ssh deploy@72.60.135.114` (root login is off).

---

## Part A: Accounts 👤 (about 1 hour)

### A1. SSH key on your computer (skip if you already have one)
In PowerShell:
```bash
ssh-keygen -t ed25519
```
Press Enter for each question. Your public key is in `C:\Users\<you>\.ssh\id_ed25519.pub`.

### A2. Order the server at Hostinger
1. hostinger.com → **VPS Hosting** → **KVM 4** (4 vCPU, 16 GB RAM, 200 GB NVMe).
   Buy it as a **new, separate VPS**. Don't reuse the n8n server, so if one goes down the other keeps running.
   Tip: a 12- or 24-month term is much cheaper per month, but check the **renewal** price too.
2. In the setup steps (hPanel):
   - **Location:** Europe, the closest one offered to Frankfurt (Germany, France or the Netherlands).
   - **Operating system:** **Plain OS → Ubuntu 24.04**. Don't pick a control panel or an app template (not Coolify, not the Docker template).
   - **Root password:** set a long one and save it in your password manager. It's only a backup; you'll log in with the key.
   - **SSH key:** paste the contents of `id_ed25519.pub`. If setup doesn't ask, add it later in the VPS page's SSH keys settings.
3. Write down the VPS **IP address** from hPanel.
4. **Hostinger firewall (in hPanel):** if you turn it on, allow **22 (SSH)** and **6380 (Garnet cache)** only.
   The server's own firewall (B2) does the same job, so either is fine; just don't block 22, or you'll lock yourself out.
5. **Backups:** turn on Hostinger's weekly VPS backup or snapshots as an extra safety net. The nightly
   database backup to R2 (B8) is still the main one.

> **Bigger server later:** when the store grows, move to Hostinger **KVM 8** (32 GB) or a dedicated server
> (for example Hetzner AX42). The files stay the same; only the memory numbers at the top of
> `docker-compose.yml` change (the other sizes are written there).

### A3. Cloudflare
1. Your domain must use Cloudflare DNS. If not: Cloudflare → Add site → change the nameservers at your domain registrar.
2. **R2** → enable it → create 3 buckets:
   - `store-media`: public. Settings → Custom domain → `media.<your-domain>`
   - `store-private`: private
   - `store-backups`: private
3. R2 → **Manage API tokens** → create a token with "Object Read & Write" on those 3 buckets.
   Save the **Access Key ID**, **Secret Access Key** and the **endpoint** in your password manager.
4. **Zero Trust → Networks → Tunnels** → Create tunnel (type: Cloudflared) → name it `store-db`.
   Copy the **tunnel token** to your password manager. Skip the install command it shows; Docker runs it.
5. In the tunnel → **Public hostname** → add:
   - Subdomain `db-api`, your domain → Service **HTTP** → `caddy:80`

---

## Part B: Set up the server 👤 (about 1–2 hours)

### B1. Copy the files to the server
From the project folder on your computer:
```bash
scp -r infra/server root@SERVER_IP:/root/store-files
```

If it asks "Are you sure you want to continue connecting?", type `yes`. If the key login doesn't work,
use hPanel's **Browser terminal** (on the VPS page) to log in as root and check `/root/.ssh/authorized_keys`.

### B2. Harden the server and install Docker
```bash
ssh root@SERVER_IP
```
```bash
bash /root/store-files/scripts/setup-server.sh
```
This takes about 5 minutes. It updates Ubuntu, adds 4 GB of swap, installs Docker, creates the `deploy`
user with your key, turns off password and root logins, and turns on the firewall.
In a **new** PowerShell window, check you can log in as `deploy` before closing the root window:
```bash
ssh deploy@SERVER_IP
```
Then, still as root, move the files into place:
```bash
cp -r /root/store-files/. /opt/store/ && chown -R deploy:deploy /opt/store && chmod +x /opt/store/scripts/*.sh
```

### B3. Make the keys (on your computer)
```bash
node scripts/make-jwt-keys.mjs
```
This prints `JWT_SECRET` (for the server) and two keys (for Vercel, used in Part F). Save all three in your password manager.

### B4. Fill in the settings file (on the server, as deploy)
```bash
cd /opt/store && cp .env.example .env && nano .env
```
Fill in `POSTGRES_PASSWORD` and `AUTHENTICATOR_PASSWORD` (make each with `openssl rand -base64 36`),
plus `JWT_SECRET` and `CLOUDFLARE_TUNNEL_TOKEN`. Save with Ctrl+O, Enter, Ctrl+X.
```bash
chmod 600 .env
```

### B5. Start it
```bash
cd /opt/store && docker compose up -d && docker compose ps
```
All 4 services should say `running` (postgres `healthy`).

### B6. Create the database roles
```bash
cd /opt/store && set -a && . ./.env && set +a && docker compose exec -T postgres psql -U postgres -d app -v authenticator_password="$AUTHENTICATOR_PASSWORD" < sql/01-roles.sql
```

### B7. Check it is reachable
On your computer, open `https://db-api.<your-domain>/health`. It should show `ok`.

### B8. Turn on nightly backups
Configure rclone for R2 (use the R2 keys from A3):
```bash
rclone config
```
Choose: `n` (new) → name `r2` → storage `s3` → provider `Cloudflare` → enter the Access Key and Secret → endpoint
from A3 → accept the defaults for the rest. Then:
```bash
crontab -e
```
Add this line, then save:
```
0 3 * * * /opt/store/scripts/backup.sh >> /opt/store/backup.log 2>&1
```
You can run one backup right away after Part C, to test it:
```bash
/opt/store/scripts/backup.sh
```

---

## Part C: Copy the database (test copy) 👤 (about 1 hour)

### C1. Get the Supabase connection string
Supabase dashboard → your **main** project (not the chat one) → **Connect** → **Session pooler** → copy the URI
and put your database password into it.

### C2. Download a copy of the database (on the server)
```bash
cd /opt/store && mkdir -p dump && read -s -p "Supabase URI: " SUPA && echo && docker run --rm -v "$PWD/dump:/dump" postgres:17.2 pg_dump "$SUPA" --schema=public --no-owner --no-privileges -Fc -f /dump/supabase.dump && unset SUPA && ls -lh dump
```

### C3. Load it into the new database
```bash
cd /opt/store && docker compose exec -T postgres pg_restore -U postgres -d app --no-owner --no-privileges < dump/supabase.dump
```
A few errors are **expected and harmless**: "schema public already exists", anything about
`supabase_realtime` or `publication`, and the `auth.users` foreign keys. Copy any **other** errors and send them to Claude.

### C4. Finish setup
```bash
cd /opt/store && docker compose exec -T postgres psql -U postgres -d app < sql/02-after-restore.sql
```

### C5. Compare row counts
Run `infra/server/sql/row-counts.sql` in the Supabase SQL editor, then on the server:
```bash
cd /opt/store && docker compose exec -T postgres psql -U postgres -d app < sql/row-counts.sql
```
The two lists must match.

### C6. Test the API with the service key
```bash
curl "https://db-api.<your-domain>/rest/v1/store_settings?select=*&limit=1" -H "apikey: SERVICE_KEY" -H "Authorization: Bearer SERVICE_KEY"
```
You should get JSON back. `[]` is fine if the table is empty.

---

## Part D: Code changes 🤖 (about 3–5 days)

Each change can go live before the switch: it stays off until its setting is filled in.

- [x] **D1. OTP limits.** Done. Per phone: 3 codes per 10 min. Per IP: 20 codes per hour. Store-wide: 500 codes per hour
      (`OTP_GLOBAL_HOURLY_LIMIT`). Guesses: 5 per code (then the code is cancelled) and 20 per phone per day.
      Phone-only login: 30 per IP per hour. **👤 Apply `supabase/migrations/0061_rate_limits.sql` in the Supabase SQL editor.**
      Until then the limits are skipped and nothing breaks.
- [ ] **D2. Storage helper** `src/lib/storage.ts` with a `STORAGE_DRIVER=supabase|r2` setting. The 11 files switch to it.
      `themes`, `entity-images` and `files` go to `store-media`; `courier-proofs` and `live-recordings` go to `store-private`.
- [ ] **D3. `catalog-feed`** becomes the Next.js route `/api/catalog-feed`.
- [ ] **D4. Live-stream chat** gets its own realtime settings (`NEXT_PUBLIC_REALTIME_URL` / `_KEY`) pointing at the chat Supabase project.
- [ ] **D5. Garnet cache helper** `src/lib/cache.ts`: off until `GARNET_URL` is set, and falls back to the database if the cache is down.
- [ ] **D6. Image link rewrite SQL** `infra/server/sql/03-rewrite-storage-urls.sql`, plus a check that no `supabase.co` links remain.
- [ ] **D7.** Add `media.<your-domain>` to `next.config.mjs` images.

---

## Part E: Copy files to R2 👤 (about 1 hour, depending on size)

1. Supabase dashboard → Project Settings → **Storage** → S3 connection → create an access key.
   Note the endpoint (`https://<ref>.supabase.co/storage/v1/s3`) and region.
2. On the server, add a second rclone remote named `supa`:
```bash
rclone config
```
   Choose: new → `supa` → `s3` → provider `Other` → the Supabase key, secret, endpoint and region.
3. Copy each bucket:
```bash
rclone copy supa:themes r2:store-media/themes --progress
```
```bash
rclone copy supa:entity-images r2:store-media/entity-images --progress
```
```bash
rclone copy supa:files r2:store-media/files --progress
```
```bash
rclone copy supa:courier-proofs r2:store-private/courier-proofs --progress
```
```bash
rclone copy supa:live-recordings r2:store-private/live-recordings --progress
```

---

## Part F: Test on a Vercel preview 👤🤖 (about 1 week)

1. Vercel → Project → Settings → Environment Variables. Add these for the **Preview** environment **only**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://db-api.<your-domain>`
   - `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the keys from B3
   - `STORAGE_DRIVER=r2`, plus the R2 keys, endpoint and bucket names (exact names come with D2)
   - `NEXT_PUBLIC_REALTIME_URL` / `_KEY` = the chat Supabase project's URL and anon key
2. Run the image link rewrite (D6) on the server.
3. Push a branch → open its preview link → go through the **smoke-test checklist** in section 8 of
   [migration-self-hosted-postgres.md](migration-self-hosted-postgres.md).
4. Send any problem to Claude, then fix and retest.

---

## Part G: The switch 👤 (one evening, about 1 hour)

1. Pick a quiet time and turn on maintenance mode, or pause checkout.
2. Wipe the test copy and load fresh data (on the server):
```bash
cd /opt/store && docker compose exec -T postgres psql -U postgres -d app -c "drop schema public cascade; create schema public;"
```
   Then repeat **C2, C3 and C4**, the link rewrite (D6), and **C5** (counts must match).
3. Copy any new files: repeat Part E with `rclone sync` in place of `rclone copy`.
4. Vercel → copy the Preview environment variables to **Production** → Redeploy.
5. Run the smoke-test checklist on the live site. Place one real COD order and one Paymob order.
6. Turn checkout back on.
7. Run a backup by hand: `/opt/store/scripts/backup.sh`.

**If something serious breaks:** set the old Supabase values back in Vercel Production and redeploy. Any
orders placed in between must be copied back by hand, so decide quickly.

---

## Part H: After the switch

- [ ] **Week 1:** check `/opt/store/backup.log` every day, and the uptime monitor.
- [ ] **Week 1:** test a restore. Load the newest backup into a scratch database and check the row counts.
- [ ] **Garnet cache:** generate the certificate, then `docker compose --profile cache up -d`, and set `GARNET_URL` in Vercel.
      Claude will give the exact steps once D5 is done.
- [ ] **After 2–4 weeks with no problems:** pause (don't delete) the main Supabase project. Keep the chat project.
- [ ] **Monthly:** run `docker compose pull && docker compose up -d` for updates, and test a restore.
