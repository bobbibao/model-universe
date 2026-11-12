#!/bin/bash
# Sets a Mac up as the 24/7 host of modeluniverse.vn (scripts/host/README.md, macOS section). Bash 3.2 compatible.
# Run from a clone of the repository, one step at a time:
#   check                 what is installed and what is missing (Homebrew, Node 22, PostgreSQL 18, cloudflared, openssl@3)
#   build                 yarn install + release build (the old host keeps serving meanwhile)
#   restore <bundle>      decrypt the file from export-host.ps1; restore database, uploads, env files, tunnel credentials
#                         (refuses while modeluniverse.vn still answers, unless FORCE=1)
#   service               launchd daemons (start at boot, no login needed, restarted if they die) for PostgreSQL, the
#                         web and the tunnel; keeps the Mac awake on power. Asks for your password (sudo).
#   redeploy              pull, build a new release and restart the web on it (about 20 s of downtime)
#   status                state of the three daemons and of the public site
# The bundle key comes from MU_BUNDLE_KEY or ~/.model-universe-bundle-key (copied from the old host).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
APP="$ROOT/apps/web-ecommerce"
RUNTIME="${MU_RUNTIME:-$HOME/ModelUniverseRuntime}"
HOSTDIR="$RUNTIME/host"
LABEL=vn.modeluniverse
log() { echo "$(date +%H:%M:%S) $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

BREW=$(command -v brew || ls /opt/homebrew/bin/brew /usr/local/bin/brew 2>/dev/null | head -1 || true)
prefix() { "$BREW" --prefix "$1" 2>/dev/null; }
NODE_BIN=""; PG_BIN=""; OPENSSL=""; CLOUDFLARED=""
if [ -n "$BREW" ]; then
  [ -x "$(prefix node@22)/bin/node" ] && NODE_BIN="$(prefix node@22)/bin"
  [ -x "$(prefix postgresql@18)/bin/psql" ] && PG_BIN="$(prefix postgresql@18)/bin"
  [ -x "$(prefix openssl@3)/bin/openssl" ] && OPENSSL="$(prefix openssl@3)/bin/openssl"
fi
CLOUDFLARED=$(command -v cloudflared || true)
PGDATA=""; if [ -n "$PG_BIN" ]; then PGDATA="$("$BREW" --prefix)/var/postgresql@18"; fi
# Official binaries, for a macOS that Homebrew has no bottles for (it would compile from source for hours):
# Node 22 tarball (nodejs.org) and cloudflared (GitHub release) unpacked into $RUNTIME/tools, PostgreSQL 18 from
# Postgres.app or the EDB installer. Their cluster lives in $RUNTIME/postgres-18 (created by restore).
TOOLS="$RUNTIME/tools"
if [ -z "$NODE_BIN" ] && [ -x "$TOOLS/node/bin/node" ]; then NODE_BIN="$TOOLS/node/bin"; fi
if [ -z "$PG_BIN" ]; then
  for d in /Applications/Postgres.app/Contents/Versions/18/bin /Library/PostgreSQL/18/bin; do
    if [ -x "$d/psql" ]; then PG_BIN="$d"; PGDATA="$RUNTIME/postgres-18"; break; fi
  done
fi
if [ -z "$CLOUDFLARED" ] && [ -x "$TOOLS/cloudflared" ]; then CLOUDFLARED="$TOOLS/cloudflared"; fi
[ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
envget() { grep -E "^$1=" "$APP/.env" | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
pg_running() { [ -n "$PG_BIN" ] && "$PG_BIN/pg_isready" -q -h 127.0.0.1 -p 5432; }
public_up() { curl -fsS -m 15 -o /dev/null https://modeluniverse.vn/api/products/filters; }

build_release() {
  cd "$APP"
  corepack enable >/dev/null 2>&1 || "$NODE_BIN/corepack" enable
  yarn install --immutable
  mkdir -p "$RUNTIME"
  # Node resolves modules from the real path of build-output/ and releases/ (outside the repository): let it find
  # the app's node_modules from the runtime folder.
  ln -sfn "$APP/node_modules" "$RUNTIME/node_modules"
  mkdir -p "$APP/dist"  # the release link dist/.next-live-* goes here (absent in a fresh clone)
  MODEL_UNIVERSE_RUNTIME_DIR="$RUNTIME" MODEL_UNIVERSE_BUILD_SNAPSHOT=true SHOP_PUBLIC_URL=https://modeluniverse.vn \
    node scripts/build-production.cjs
  log "Release built: $(cat "$RUNTIME/release.json" | tr -d '\n ')"
}

case "${1:-}" in
check)
  ok() { printf '%-30s %s\n' "$1" "$2"; }
  missing=0
  [ -n "$BREW" ] && ok Homebrew ok || { ok Homebrew MISSING; missing=1; }
  [ -n "$NODE_BIN" ] && ok 'Node 22 (node@22)' "ok $("$NODE_BIN/node" -v)" || { ok 'Node 22 (node@22)' MISSING; missing=1; }
  [ -n "$PG_BIN" ] && ok 'PostgreSQL 18' "ok $PG_BIN" || { ok 'PostgreSQL 18' MISSING; missing=1; }
  [ -n "$OPENSSL" ] && ok 'openssl@3' ok || { ok 'openssl@3' MISSING; missing=1; }
  [ -n "$CLOUDFLARED" ] && ok cloudflared ok || { ok cloudflared MISSING; missing=1; }
  { [ -n "${MU_BUNDLE_KEY:-}" ] || [ -f "$HOME/.model-universe-bundle-key" ]; } && ok 'Bundle key file' ok || { ok 'Bundle key file' 'MISSING (copy it from the old host)'; missing=1; }
  echo "Runtime folder: $RUNTIME"
  if [ "$missing" = 1 ]; then
    cat <<'EOF'
Install hints:
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"   (Homebrew)
  brew install node@22 postgresql@18 openssl@3 cloudflared
If Homebrew compiles from source (no bottles for this macOS), use official binaries instead:
  Node 22 darwin tarball from nodejs.org unpacked to ~/ModelUniverseRuntime/tools/node
  cloudflared-darwin-*.tgz from github.com/cloudflare/cloudflared/releases unpacked to ~/ModelUniverseRuntime/tools
  PostgreSQL 18: Postgres.app (/Applications/Postgres.app) or the EDB installer (/Library/PostgreSQL/18)
EOF
    exit 1
  fi
  ;;
build)
  [ -n "$NODE_BIN" ] || die 'run check first'
  build_release
  ;;
restore)
  BUNDLE="${2:-}"; [ -f "$BUNDLE" ] || die 'usage: restore <path to model-universe-host.enc>'
  if public_up && [ "${FORCE:-0}" != 1 ]; then die 'modeluniverse.vn still answers: run export-host.ps1 on the old host first (or FORCE=1).'; fi
  export MU_BUNDLE_KEY="${MU_BUNDLE_KEY:-$(tr -d '\r\n' < "$HOME/.model-universe-bundle-key")}"
  STAGE=$(mktemp -d); trap 'rm -rf "$STAGE"' EXIT
  "$OPENSSL" enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:MU_BUNDLE_KEY -in "$BUNDLE" | tar -xz -C "$STAGE" || die 'decryption failed (wrong key?)'
  log "Bundle from $(grep -o '"source"[^,}]*' "$STAGE/meta.json")"

  # Env files (Windows line endings removed); runtime folder of this Mac; agent runtime off.
  tr -d '\r' < "$STAGE/env/web/.env" > "$APP/.env"
  tr -d '\r' < "$STAGE/env/web/.env.production.local" | grep -vE '^(TEMP|TMP)=' |
    sed -e "s#^MODEL_UNIVERSE_RUNTIME_DIR=.*#MODEL_UNIVERSE_RUNTIME_DIR=$RUNTIME#" -e 's#^START_AGENT_RUNTIME=.*#START_AGENT_RUNTIME=false#' \
    > "$APP/.env.production.local"
  [ -f "$STAGE/env/agent/.env" ] && tr -d '\r' < "$STAGE/env/agent/.env" > "$ROOT/apps/agent-service/.env"
  [ -f "$STAGE/env/infra/.env" ] && tr -d '\r' < "$STAGE/env/infra/.env" > "$ROOT/infra/.env"
  chmod 600 "$APP/.env" "$APP/.env.production.local"
  mkdir -p "$APP/uploads" && rsync -a "$STAGE/uploads/" "$APP/uploads/"

  mkdir -p "$HOME/.cloudflared" && cp "$STAGE/cloudflared/"* "$HOME/.cloudflared/"
  cred=$(ls "$HOME/.cloudflared/"*.json | head -1)
  tr -d '\r' < "$HOME/.cloudflared/config.yml" | sed "s#^credentials-file:.*#credentials-file: $cred#" > "$HOME/.cloudflared/config.yml.new"
  mv "$HOME/.cloudflared/config.yml.new" "$HOME/.cloudflared/config.yml"
  chmod 600 "$HOME/.cloudflared/"*

  # Database: a "postgres" role with the old host's password, the same database name, restored from the dump.
  # A cluster like Homebrew's (superuser = this Mac user, UTF8, locale C, listens on localhost only).
  [ -f "$PGDATA/PG_VERSION" ] || "$PG_BIN/initdb" -D "$PGDATA" -U "$(id -un)" -E UTF8 --locale=C --auth=trust >/dev/null
  pg_running || "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$RUNTIME/postgres.log" -w start
  DB_USER=$(envget DB_USERNAME); DB_PASS=$(envget DB_PASSWORD); DB_NAME=$(envget DB_NAME)
  "$PG_BIN/psql" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -d postgres -v user="$DB_USER" -v pass="$DB_PASS" -v db="$DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN SUPERUSER', :'user') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'user') \gexec
ALTER ROLE :"user" WITH LOGIN SUPERUSER PASSWORD :'pass';
SELECT format('DROP DATABASE IF EXISTS %I WITH (FORCE)', :'db') \gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'db', :'user') \gexec
SQL
  PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -f "$STAGE/db.sql" > "$RUNTIME/restore.log"
  log "Restored: database ($(PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -tA -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c 'select count(*) from product') products), uploads, env files, tunnel credentials."
  ;;
service)
  [ -f "$RUNTIME/release.json" ] || die 'run build first'
  [ -f "$HOME/.cloudflared/config.yml" ] || die 'run restore first'
  ME=$(id -un)
  mkdir -p "$HOSTDIR"
  # The web reads the current release at every start, so a redeploy only needs a restart.
  cat > "$HOSTDIR/run-web.sh" <<EOF
#!/bin/bash
cd "$APP"
DIST=\$("$NODE_BIN/node" -p "require('$RUNTIME/release.json').nextDist")
export NODE_ENV=production PORT=6050 NEXT_DIST_DIR="\$DIST" PATH="$NODE_BIN:/usr/bin:/bin"
exec "$NODE_BIN/node" "\$DIST/server.js"
EOF
  chmod 755 "$HOSTDIR/run-web.sh"
  plist() {  # plist <name> <program and arguments...>
    local name=$1; shift
    local args=""; for a in "$@"; do args="$args<string>$a</string>"; done
    cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL.$name</string>
  <key>UserName</key><string>$ME</string>
  <key>ProgramArguments</key><array>$args</array>
  <key>EnvironmentVariables</key><dict><key>HOME</key><string>$HOME</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$HOSTDIR/$name.log</string>
  <key>StandardErrorPath</key><string>$HOSTDIR/$name.log</string>
</dict></plist>
EOF
  }
  # PostgreSQL moves from brew services (only after login) to a boot daemon.
  "$BREW" services stop postgresql@18 >/dev/null 2>&1 || true
  pg_running && "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast -w stop || true
  plist postgres "$PG_BIN/postgres" -D "$PGDATA" > "$HOSTDIR/postgres.plist"
  plist web "$HOSTDIR/run-web.sh" > "$HOSTDIR/web.plist"
  plist tunnel "$CLOUDFLARED" --no-autoupdate --config "$HOME/.cloudflared/config.yml" tunnel run model-universe > "$HOSTDIR/tunnel.plist"
  log 'Installing the boot daemons (sudo asks for your Mac password).'
  for name in postgres web tunnel; do
    sudo cp "$HOSTDIR/$name.plist" "/Library/LaunchDaemons/$LABEL.$name.plist"
    sudo chown root:wheel "/Library/LaunchDaemons/$LABEL.$name.plist"
    sudo launchctl bootout "system/$LABEL.$name" 2>/dev/null || true
    sudo launchctl bootstrap system "/Library/LaunchDaemons/$LABEL.$name.plist"
    [ "$name" = postgres ] && sleep 5
  done
  # Awake on power. A MacBook still sleeps when its lid is closed unless an external display is attached:
  # keep the lid open (or use clamshell mode with a display).
  sudo pmset -c sleep 0 disksleep 0 standby 0 autopoweroff 0 powernap 0 womp 1 autorestart 1
  log 'Waiting for https://modeluniverse.vn'
  for _ in $(seq 1 60); do public_up && { log 'modeluniverse.vn answers from this Mac.'; exit 0; }; sleep 5; done
  die "no public answer yet: see $HOSTDIR/web.log and tunnel.log"
  ;;
redeploy)
  git -C "$ROOT" pull --ff-only
  build_release
  sudo launchctl kickstart -k "system/$LABEL.web"
  for _ in $(seq 1 60); do curl -fsS -m 10 -o /dev/null http://127.0.0.1:6050/api/products/filters && { log 'Web restarted on the new release.'; exit 0; }; sleep 2; done
  die "web did not come back: see $HOSTDIR/web.log"
  ;;
status)
  for name in postgres web tunnel; do sudo launchctl print "system/$LABEL.$name" 2>/dev/null | grep -E '^[[:space:]]*state =' | sed "s/^/$name: /" || echo "$name: not installed"; done
  public_up && echo 'public: 200' || echo 'public: DOWN'
  ;;
*)
  sed -n '2,15p' "$0"; exit 1
  ;;
esac
