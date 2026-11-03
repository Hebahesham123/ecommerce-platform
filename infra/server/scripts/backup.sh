#!/usr/bin/env bash
# Nightly database backup.
#
#   1. Always: a compressed copy in /opt/store/backups on this server, kept 14 days.
#      Protects against mistakes (deleted products, a bad change). Not against losing the server.
#   2. If an rclone remote named $BACKUP_REMOTE exists (e.g. Cloudflare R2): the same copy is also
#      uploaded there and kept 30 days. That one survives losing the whole server.
#
# Scheduled by:  crontab -l   (0 3 * * * /opt/store/scripts/backup.sh >> /opt/store/backup.log 2>&1)
set -euo pipefail
cd /opt/store
set -a; source .env; set +a

LOCAL_DIR=/opt/store/backups
KEEP_LOCAL_DAYS=14
KEEP_REMOTE_DAYS=30
STAMP=$(date -u +%Y-%m-%dT%H%MZ)
FILE="$LOCAL_DIR/app-$STAMP.dump"

install -d -m 700 "$LOCAL_DIR"
umask 077
echo "[$(date -u)] backup → $FILE"

# </dev/null: without it, "docker compose exec" can swallow the rest of a piped script.
docker compose exec -T postgres pg_dump -U postgres -d app -Fc </dev/null > "$FILE.part"
mv "$FILE.part" "$FILE"

# Check the file is a real, readable backup before trusting it.
SIZE=$(stat -c %s "$FILE")
if [ "$SIZE" -lt 100000 ]; then echo "FAILED: backup too small ($SIZE bytes)"; exit 1; fi
TABLES=$(docker run --rm -v "$LOCAL_DIR":/b:ro postgres:17.2 pg_restore -l "/b/$(basename "$FILE")" </dev/null | grep -c " TABLE DATA ")
if [ "$TABLES" -lt 10 ]; then echo "FAILED: backup lists only $TABLES tables"; exit 1; fi
echo "ok: $SIZE bytes, $TABLES tables"

find "$LOCAL_DIR" -name 'app-*.dump' -mtime +"$KEEP_LOCAL_DAYS" -delete

if command -v rclone >/dev/null && rclone listremotes 2>/dev/null | grep -qx "${BACKUP_REMOTE:-r2}:"; then
  rclone copyto "$FILE" "${BACKUP_REMOTE:-r2}:${BACKUP_BUCKET:-store-backups}/daily/$(basename "$FILE")"
  rclone delete "${BACKUP_REMOTE:-r2}:${BACKUP_BUCKET:-store-backups}/daily" --min-age "${KEEP_REMOTE_DAYS}d"
  echo "ok: uploaded off-server to ${BACKUP_REMOTE:-r2}:${BACKUP_BUCKET:-store-backups}"
else
  echo "note: no off-server copy (rclone remote '${BACKUP_REMOTE:-r2}' not set up yet)"
fi

if [ -n "${BACKUP_PING_URL:-}" ]; then curl -fsS -m 10 "$BACKUP_PING_URL" >/dev/null || true; fi
echo "[$(date -u)] done"
