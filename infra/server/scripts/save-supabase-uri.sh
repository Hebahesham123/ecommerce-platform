#!/usr/bin/env bash
# Asks for the Supabase connection string (hidden while typing), saves it privately on the server,
# and checks it connects. Run from your computer:
#   ssh -t deploy@<server-ip> /opt/store/scripts/save-supabase-uri.sh
set -euo pipefail
cd /opt/store

# The store's Supabase project, Session pooler (Connect → Direct → Shared pooler). Not secret.
SUPA_USER="${SUPA_USER:-postgres.jvjnpfaoqfeodzujsngf}"
SUPA_HOST="${SUPA_HOST:-aws-1-eu-central-1.pooler.supabase.com}"

# Percent-encode a password so special characters can't break the connection string.
urlencode() {
  local s="$1" out="" c i
  for ((i = 0; i < ${#s}; i++)); do
    c=${s:i:1}
    case "$c" in
      [a-zA-Z0-9._~-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

echo "Paste your Supabase DATABASE PASSWORD (or the whole postgresql:// line)."
echo "Nothing will show while you paste. Press Enter after pasting."
read -rs -p "> " URI
echo

# Just a password? Build the full connection string around it.
URI_TRIMMED=$(printf '%s' "$URI" | tr -d '\r\n' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
case "$URI_TRIMMED" in
  postgres://*|postgresql://*|"") ;;
  *)
    PW=$(printf '%s' "$URI_TRIMMED" | sed -E 's/^\[(.*)\]$/\1/')
    URI="postgresql://${SUPA_USER}:$(urlencode "$PW")@${SUPA_HOST}:5432/postgres"
    echo "(Got a password; using it with ${SUPA_USER}@${SUPA_HOST}.)"
    ;;
esac

# Forgive common paste slips: spaces/newlines around it, and brackets left around the password.
URI=$(printf '%s' "$URI" | tr -d '\r\n' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
if [ -z "$URI" ]; then
  echo "Nothing was pasted. Click inside this window, paste (Ctrl+V or right-click), then press Enter."
  exit 1
fi
if printf '%s' "$URI" | grep -q 'YOUR-PASSWORD'; then
  echo "It still contains [YOUR-PASSWORD]. Replace that with your database password, then run this again."
  exit 1
fi
if printf '%s' "$URI" | grep -qE ':\[[^]@]+\]@'; then
  URI=$(printf '%s' "$URI" | sed -E 's/:\[([^]@]+)\]@/:\1@/')
  echo "(Removed the [ ] brackets around the password.)"
fi

case "$URI" in
  postgres://*|postgresql://*) ;;
  *) echo "That doesn't look like a connection string (got ${#URI} characters starting with \"${URI:0:6}\"). It must start with postgresql:// . Nothing saved."; exit 1 ;;
esac

umask 077
printf '%s' "$URI" > supa.uri
echo "Saved. Testing the connection..."
if docker run --rm -v /opt/store/supa.uri:/supa.uri:ro postgres:17.2 \
     sh -c 'psql "$(cat /supa.uri)" -Atc "select '"'"'connected: '"'"' || current_database() || '"'"', tables in public: '"'"' || (select count(*) from information_schema.tables where table_schema='"'"'public'"'"')"'; then
  echo "All good. You can close this tab."
else
  echo "Could not connect. Check the password and that you copied the Session pooler string, then run this again."
  rm -f supa.uri
  exit 1
fi
