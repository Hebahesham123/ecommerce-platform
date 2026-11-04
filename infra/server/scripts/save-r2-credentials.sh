#!/usr/bin/env bash
# Saves Cloudflare R2 keys for off-server backups, privately, and tests them.
# Run from your computer:   ssh -t deploy@<server-ip> /opt/store/scripts/save-r2-credentials.sh
# You need (from Cloudflare → R2 → Manage API tokens → your token):
#   Account ID, Access Key ID, Secret Access Key. The secret is hidden while you paste it.
set -euo pipefail
cd /opt/store
set -a; source .env; set +a
REMOTE="${BACKUP_REMOTE:-r2}"
BUCKET="${BACKUP_BUCKET:-store-backups}"

trim() { printf '%s' "$1" | tr -d '\r\n' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//'; }

echo "Cloudflare R2 setup for backups (bucket: $BUCKET)"
read -r  -p "Account ID (32 letters/numbers): " ACCOUNT;  ACCOUNT=$(trim "$ACCOUNT")
read -r  -p "Access Key ID: "                  KEY_ID;   KEY_ID=$(trim "$KEY_ID")
read -rs -p "Secret Access Key (hidden): "     SECRET;   SECRET=$(trim "$SECRET"); echo

# Accept a pasted endpoint URL instead of the bare account id.
ACCOUNT=$(printf '%s' "$ACCOUNT" | sed -E 's#^https?://##; s#\.r2\.cloudflarestorage\.com.*$##; s#/.*$##')
if ! printf '%s' "$ACCOUNT" | grep -qE '^[0-9a-f]{32}$'; then
  echo "The Account ID should be 32 characters (0-9, a-f). Got ${#ACCOUNT} characters. Nothing saved."; exit 1
fi
[ -n "$KEY_ID" ] && [ -n "$SECRET" ] || { echo "Access Key ID or Secret is empty. Nothing saved."; exit 1; }

umask 077
mkdir -p ~/.config/rclone
CONF=~/.config/rclone/rclone.conf
# Replace any earlier [$REMOTE] section, keep anything else.
if [ -f "$CONF" ]; then
  awk -v r="[$REMOTE]" '$0==r{skip=1;next} /^\[/{skip=0} !skip' "$CONF" > "$CONF.new" && mv "$CONF.new" "$CONF"
fi
cat >> "$CONF" <<CFG
[$REMOTE]
type = s3
provider = Cloudflare
access_key_id = $KEY_ID
secret_access_key = $SECRET
endpoint = https://$ACCOUNT.r2.cloudflarestorage.com
region = auto
no_check_bucket = true
CFG
chmod 600 "$CONF"
unset SECRET

echo "Saved. Testing an upload to $BUCKET..."
TEST="connection-test-$(date -u +%s).txt"
if printf 'ok %s\n' "$(date -u)" | rclone rcat "$REMOTE:$BUCKET/$TEST" && rclone deletefile "$REMOTE:$BUCKET/$TEST"; then
  echo "All good: the server can write to R2. Tonight's backup will also be copied there."
else
  echo "Could not write to the bucket. Check: bucket name is exactly '$BUCKET', and the token has"
  echo "'Object Read & Write' permission on it. Then run this again."
  exit 1
fi
