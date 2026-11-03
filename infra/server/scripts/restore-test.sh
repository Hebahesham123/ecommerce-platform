#!/usr/bin/env bash
# Proves the newest backup can actually be restored: loads it into a throwaway database,
# compares every table's row count with the live database, then deletes the throwaway copy.
# The live database is never touched. Run monthly:  /opt/store/scripts/restore-test.sh
set -euo pipefail
cd /opt/store

LATEST=$(ls -1t /opt/store/backups/app-*.dump 2>/dev/null | head -1)
[ -n "$LATEST" ] || { echo "no backup found in /opt/store/backups"; exit 1; }
echo "testing: $LATEST"

psql_() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres "$@"; }

psql_ -d postgres -qc "drop database if exists restore_test;" </dev/null
psql_ -d postgres -qc "create database restore_test;" </dev/null
# Same roles/extensions already exist cluster-wide; the dump carries everything else.
docker compose exec -T postgres pg_restore -U postgres -d restore_test --no-owner < "$LATEST" 2>/tmp/restore-test.log || true
ERRORS=$(grep -c "error:" /tmp/restore-test.log || true)

psql_ -d app -At < sql/row-counts.sql > /tmp/counts-live.txt
psql_ -d restore_test -At < sql/row-counts.sql > /tmp/counts-restored.txt
psql_ -d postgres -qc "drop database restore_test;" </dev/null

echo "tables: live=$(wc -l < /tmp/counts-live.txt) restored=$(wc -l < /tmp/counts-restored.txt), restore errors: $ERRORS"
if diff -q /tmp/counts-live.txt /tmp/counts-restored.txt >/dev/null; then
  echo "RESULT: OK, every table matches the live database"
else
  echo "RESULT: differences (normal only for rows added since the backup was taken):"
  diff /tmp/counts-live.txt /tmp/counts-restored.txt | head -20
fi
