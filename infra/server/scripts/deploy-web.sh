#!/usr/bin/env bash
# Builds and starts the store website from GitHub main, on this server.
#
#   deploy-web.sh          deploy only if main has a new commit (run by cron every 2 minutes)
#   deploy-web.sh --force  rebuild the current commit anyway
#   deploy-web.sh --rollback   go back to the previous working build
#
# The new build replaces the running one only after it starts and answers its health check, so a
# broken commit never takes the site down: the old one keeps serving.
set -euo pipefail
cd /opt/store
exec 9>/opt/store/.deploy-web.lock
flock -n 9 || { echo "another deploy is running"; exit 0; }

REPO=https://github.com/Hebahesham123/ecommerce-platform.git
SRC=/opt/store/web-src
LOG=/opt/store/deploy-web.log
STATE=/opt/store/.web-current   # the commit that is live now
PREV=/opt/store/.web-previous   # the one before it (for --rollback)
say() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG"; }

if [ "${1:-}" = "--rollback" ]; then
  [ -s "$PREV" ] || { say "nothing to roll back to"; exit 1; }
  BACK=$(cat "$PREV")
  say "rolling back to $BACK"
  WEB_IMAGE="store-web:$BACK" docker compose up -d --no-deps web </dev/null
  cp "$STATE" "$PREV"; echo "$BACK" > "$STATE"
  exit 0
fi

[ -d "$SRC/.git" ] || git clone -q "$REPO" "$SRC"
git -C "$SRC" fetch -q origin main
NEW=$(git -C "$SRC" rev-parse --short=12 origin/main)
CUR=$(cat "$STATE" 2>/dev/null || true)
if [ "$NEW" = "$CUR" ] && [ "${1:-}" != "--force" ]; then exit 0; fi

say "deploying $NEW ($(git -C "$SRC" log -1 --format=%s origin/main | cut -c1-70))"
git -C "$SRC" reset -q --hard origin/main

# Public settings are baked into the build; secrets are not.
grep -E '^NEXT_PUBLIC_[A-Z0-9_]+=' /opt/store/web.env > "$SRC/.env.production" || true

T0=$(date +%s)
if ! docker build -q -f "$SRC/infra/server/web.Dockerfile" -t "store-web:$NEW" "$SRC" >>"$LOG" 2>&1; then
  say "BUILD FAILED for $NEW, the site keeps running $CUR (details above in $LOG)"
  exit 1
fi
say "built in $(( $(date +%s) - T0 ))s"

# Start the new build next to the old one and wait until it answers.
docker rm -f store-web-next >/dev/null 2>&1 || true
NET=$(docker inspect store-caddy-1 -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
docker run -d --name store-web-next --network "$NET" --env-file /opt/store/web.env "store-web:$NEW" >/dev/null
for i in $(seq 1 40); do
  if docker exec store-web-next wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null 2>&1; then OK=1; break; fi
  sleep 3
done
docker rm -f store-web-next >/dev/null 2>&1 || true
if [ "${OK:-0}" != 1 ]; then
  say "NEW BUILD DID NOT START for $NEW, the site keeps running $CUR"
  exit 1
fi

WEB_IMAGE="store-web:$NEW" docker compose up -d --no-deps web </dev/null >>"$LOG" 2>&1
[ -n "$CUR" ] && echo "$CUR" > "$PREV"
echo "$NEW" > "$STATE"
say "LIVE: $NEW"

# Keep the last 3 builds, remove older ones.
docker images store-web --format '{{.Tag}} {{.CreatedAt}}' | sort -k2 -r | awk 'NR>3 {print $1}' \
  | grep -vxF "$NEW" | grep -vxF "$(cat "$PREV" 2>/dev/null)" | xargs -r -I{} docker rmi "store-web:{}" >/dev/null 2>&1 || true
docker builder prune -f --filter until=72h >/dev/null 2>&1 || true
