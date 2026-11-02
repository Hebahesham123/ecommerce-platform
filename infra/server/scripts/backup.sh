#!/usr/bin/env bash
# Nightly database backup to Cloudflare R2. Keeps 30 days.
# Install with:  crontab -e   and add:
#   0 3 * * * /opt/store/scripts/backup.sh >> /opt/store/backup.log 2>&1
set -euo pipefail
cd /opt/store
set -a; source .env; set +a

STAMP=$(date -u +%Y-%m-%dT%H%MZ)
TARGET="${BACKUP_REMOTE}:${BACKUP_BUCKET}/daily/app-${STAMP}.dump"

echo "[$(date -u)] backup → ${TARGET}"
docker compose exec -T postgres pg_dump -U postgres -d app -Fc | rclone rcat "${TARGET}"

# Fail loudly if the upload is suspiciously small.
SIZE=$(rclone size --json "${TARGET}" | sed -E 's/.*"bytes":([0-9]+).*/\1/')
if [ "${SIZE}" -lt 100000 ]; then
  echo "backup too small (${SIZE} bytes)"; exit 1
fi

rclone delete "${BACKUP_REMOTE}:${BACKUP_BUCKET}/daily" --min-age 30d

if [ -n "${BACKUP_PING_URL:-}" ]; then curl -fsS -m 10 "${BACKUP_PING_URL}" >/dev/null || true; fi
echo "[$(date -u)] ok (${SIZE} bytes)"
