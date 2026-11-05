#!/usr/bin/env bash
# Runs modeluniverse.vn from a Linux cloud session (scripts/cloud/README.md).
# Phase 1 (laptop still serving): install Node 22, PostgreSQL, cloudflared; build the web.
# Phase 2: wait for the laptop's encrypted hand-off bundle in the private repo MU_HANDOFF_REPO (branch `handoff`),
#          restore the database, uploads, env files and tunnel credentials, start the web on 6050 and the tunnel.
# Then a watchdog restarts the web/tunnel if they die and pushes an encrypted backup every hour (branch `cloud-backup`).
# Needs: MU_HANDOFF_REPO (owner/name), MU_HANDOFF_TOKEN (GitHub token with read/write on that repo), MU_BUNDLE_KEY.
set -euo pipefail
: "${MU_HANDOFF_REPO:?set MU_HANDOFF_REPO}" "${MU_HANDOFF_TOKEN:?set MU_HANDOFF_TOKEN}" "${MU_BUNDLE_KEY:?set MU_BUNDLE_KEY}"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
APP=$ROOT/apps/web-ecommerce
STATE=${MU_STATE_DIR:-$HOME/mu}
mkdir -p "$STATE"
log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$STATE/start.log"; }
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
as_postgres() { if [ "$(id -u)" -eq 0 ]; then runuser -u postgres -- "$@"; else sudo -u postgres "$@"; fi; }
REMOTE="https://x-access-token:${MU_HANDOFF_TOKEN}@github.com/${MU_HANDOFF_REPO}.git"
export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- phase 1: tools and build
if ! node -v 2>/dev/null | grep -q '^v2[2-9]'; then
  log 'Installing Node 22'
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO -E bash - >/dev/null
  $SUDO apt-get install -y nodejs >/dev/null
fi
if ! command -v psql >/dev/null; then
  log 'Installing PostgreSQL (18 from PGDG, else the distribution version)'
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq curl ca-certificates gnupg lsb-release >/dev/null
  if $SUDO install -d /usr/share/postgresql-common/pgdg &&
     $SUDO curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc &&
     echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | $SUDO tee /etc/apt/sources.list.d/pgdg.list >/dev/null &&
     $SUDO apt-get update -qq && $SUDO apt-get install -y -qq postgresql-18 >/dev/null; then :
  else
    $SUDO rm -f /etc/apt/sources.list.d/pgdg.list
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq postgresql >/dev/null
  fi
fi
$SUDO service postgresql start >/dev/null 2>&1 || { ver=$(ls /etc/postgresql | sort -V | tail -1); $SUDO pg_ctlcluster "$ver" main start; }
PG_MAJOR=$(psql --version | grep -oE '[0-9]+' | head -1)
if ! command -v cloudflared >/dev/null; then
  log 'Installing cloudflared'
  arch=$(dpkg --print-architecture 2>/dev/null || echo amd64)
  $SUDO curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}"
  $SUDO chmod +x /usr/local/bin/cloudflared
fi
log "Tools: node $(node -v), PostgreSQL $PG_MAJOR, $(cloudflared --version | head -1)"

if [ ! -f "$APP/dist/.next/BUILD_ID" ] || [ "${MU_REBUILD:-0}" = 1 ]; then
  log 'Building the web (the laptop is still serving)'
  cd "$APP"
  corepack enable >/dev/null 2>&1 || $SUDO corepack enable
  yarn install --immutable >>"$STATE/build.log" 2>&1
  SHOP_PUBLIC_URL=https://modeluniverse.vn NODE_ENV=production npx next build --no-lint >>"$STATE/build.log" 2>&1
  npx tsc --project tsconfig.server.json >>"$STATE/build.log" 2>&1
fi
log 'Build ready'

# ---------------------------------------------------------------- phase 2: wait for the hand-off
epoch_of() { git ls-remote --exit-code "$REMOTE" "refs/heads/$1" >/dev/null 2>&1 || { echo 0; return; }
  rm -rf "$STATE/peek" && git clone -q --depth 1 -b "$1" "$REMOTE" "$STATE/peek" && cat "$STATE/peek/READY" 2>/dev/null || echo 0; }
# A hand-off is fresh when it is newer than anything a cloud session already wrote back (handback / cloud-backup).
handback=$(epoch_of handback); backup=$(epoch_of cloud-backup)
superseded=$(( handback > backup ? handback : backup ))
log "Waiting for a laptop hand-off newer than $superseded (run scripts/cloud/handoff-laptop.ps1 on the laptop)"
while true; do
  ready=$(epoch_of handoff)
  [ "$ready" -gt "$superseded" ] && break
  sleep 15
done
log "Hand-off $ready found; restoring"
rm -rf "$STATE/bundle" && mkdir -p "$STATE/bundle"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:MU_BUNDLE_KEY -in "$STATE/peek/bundle.enc" | tar -xz -C "$STATE/bundle"
chmod -R go-rwx "$STATE/bundle"

# Env files: Linux paths, no agent runtime (the agent is not part of this session).
cp "$STATE/bundle/env/.env" "$APP/.env"
sed -e "s#^MODEL_UNIVERSE_RUNTIME_DIR=.*#MODEL_UNIVERSE_RUNTIME_DIR=$STATE/runtime#" -e '/^TEMP=/d' -e '/^TMP=/d' \
    -e 's#^START_AGENT_RUNTIME=.*#START_AGENT_RUNTIME=false#' "$STATE/bundle/env/.env.production.local" | tr -d '\r' > "$APP/.env.production.local"
sed -i 's/\r$//' "$APP/.env"
mkdir -p "$STATE/runtime"
envget() { grep -E "^$1=" "$APP/.env" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
DB_USER=$(envget DB_USERNAME); DB_PASS=$(envget DB_PASSWORD); DB_NAME=$(envget DB_NAME); DB_PORT=$(envget DB_PORT)

# Database: the same role, password and name as on the laptop, restored from the dump.
as_postgres psql -q -v ON_ERROR_STOP=1 -v user="$DB_USER" -v pass="$DB_PASS" -v db="$DB_NAME" postgres <<'SQL'
SELECT format('CREATE ROLE %I LOGIN SUPERUSER', :'user') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'user') \gexec
ALTER ROLE :"user" WITH LOGIN SUPERUSER PASSWORD :'pass';
SELECT format('DROP DATABASE IF EXISTS %I WITH (FORCE)', :'db') \gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'db', :'user') \gexec
SQL
dump="$STATE/bundle/db.sql"
if [ "$PG_MAJOR" -lt 17 ]; then  # dump from PostgreSQL 18: drop what older servers do not know
  sed -i -e '/^\\restrict /d' -e '/^\\unrestrict /d' -e '/^SET transaction_timeout/d' "$dump"
fi
PGPASSWORD="$DB_PASS" psql -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f "$dump" >>"$STATE/restore.log"
log "Database restored ($(PGPASSWORD="$DB_PASS" psql -tA -h 127.0.0.1 -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -c 'select count(*) from product') products)"

rm -rf "$APP/uploads" && cp -r "$STATE/bundle/uploads" "$APP/uploads"
mkdir -p "$HOME/.cloudflared"
cp "$STATE/bundle/cloudflared/"* "$HOME/.cloudflared/"
cred=$(ls "$HOME/.cloudflared/"*.json | head -1)
sed -i -e 's/\r$//' -e "s#^credentials-file:.*#credentials-file: $cred#" "$HOME/.cloudflared/config.yml"
chmod 600 "$HOME/.cloudflared/"*

# ---------------------------------------------------------------- start, then watch
cat > "$STATE/run-web.sh" <<EOF
#!/usr/bin/env bash
cd "$APP" && NODE_ENV=production PORT=6050 exec node dist/.next/server.js >>"$STATE/web.log" 2>&1
EOF
cat > "$STATE/run-tunnel.sh" <<EOF
#!/usr/bin/env bash
exec cloudflared --no-autoupdate --config "$HOME/.cloudflared/config.yml" tunnel run model-universe >>"$STATE/tunnel.log" 2>&1
EOF
chmod +x "$STATE/run-web.sh" "$STATE/run-tunnel.sh"
healthy() { curl -fsS -m 10 -o /dev/null http://127.0.0.1:6050/api/products/filters; }
setsid nohup "$STATE/run-web.sh" >/dev/null 2>&1 < /dev/null &
for _ in $(seq 1 90); do healthy && break; sleep 2; done
healthy || { log 'Web did not start; see web.log'; tail -30 "$STATE/web.log"; exit 1; }
log 'Web healthy on 6050'
setsid nohup "$STATE/run-tunnel.sh" >/dev/null 2>&1 < /dev/null &
for _ in $(seq 1 60); do grep -q 'Registered tunnel connection' "$STATE/tunnel.log" 2>/dev/null && break; sleep 2; done
grep -q 'Registered tunnel connection' "$STATE/tunnel.log" || { log 'Tunnel did not connect; see tunnel.log'; tail -30 "$STATE/tunnel.log"; exit 1; }
log 'Tunnel connected'

cp "$ROOT/scripts/cloud/watchdog.sh" "$STATE/watchdog.sh" && chmod +x "$STATE/watchdog.sh"
MU_STATE_DIR="$STATE" MU_APP="$APP" setsid nohup "$STATE/watchdog.sh" >/dev/null 2>&1 < /dev/null &
sleep 5
code=$(curl -s -o /dev/null -w '%{http_code}' -m 20 https://modeluniverse.vn/api/products/filters || true)
log "Public check https://modeluniverse.vn: HTTP $code. Watchdog and hourly backups running."
