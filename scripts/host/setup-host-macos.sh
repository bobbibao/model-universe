#!/bin/bash
# Sets a Mac up as the 24/7 host of modeluniverse.vn (scripts/host/README.md, macOS section). Bash 3.2 compatible.
# Run from a clone of the repository, one step at a time:
#   check                 what is installed and what is missing (Homebrew, Node 22, PostgreSQL 18, cloudflared, openssl@3)
#   build                 yarn install + release build (the old host keeps serving meanwhile)
#   restore <bundle>      decrypt the file from export-host.ps1; restore database, uploads, env files, tunnel credentials
#                         (refuses while modeluniverse.vn still answers, unless FORCE=1)
#   service               launchd daemons (start at boot, no login needed, restarted if they die) for PostgreSQL, the
#                         web and the tunnel; keeps the Mac awake on power. Asks for your password (sudo).
#   agent                 the AI Agent Server (Aegra, apps/agent-service) as a fourth daemon on 127.0.0.1:2026: its
#                         dependencies (uv), its database and read-only shop role, its env, and the web's link to it.
#                         Needs uv, the model key in apps/agent-service/.env (GOOGLE_API_KEY for LLM_PROFILE=google)
#                         and `service` done. Asks for your password (sudo).
#   deploy                build a release from this checkout and switch the web to it without downtime: requests
#                         that arrive during the restart wait behind a holding proxy instead of failing. No sudo.
#   redeploy              pull, then deploy (and restart the agent, when it is installed: that part asks for sudo)
#   status                state of the daemons and of the public site
# The bundle key comes from MU_BUNDLE_KEY or ~/.model-universe-bundle-key (copied from the old host).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
APP="$ROOT/apps/web-ecommerce"
AGENT="$ROOT/apps/agent-service"
AGENT_URL=http://127.0.0.1:2026
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
UV=$(command -v uv || true)
if [ -z "$UV" ] && [ -x "$HOME/.local/bin/uv" ]; then UV="$HOME/.local/bin/uv"; fi
envget() { grep -E "^$1=" "$APP/.env" | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
agentenv() { grep -E "^$1=" "$AGENT/.env" | tail -1 | cut -d= -f2- | tr -d '\r'; }
# setenv <file> <KEY> <value>: replace the variable's line or append it; the file stays private.
setenv() {
  local file=$1 key=$2 value=$3 tmp
  tmp=$(mktemp)
  awk -v key="$key" -v value="$value" 'BEGIN { done = 0 }
    index($0, key "=") == 1 { if (!done) print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }' "$file" > "$tmp"
  cat "$tmp" > "$file"; rm -f "$tmp"; chmod 600 "$file"
}
agent_installed() { [ -f "/Library/LaunchDaemons/$LABEL.agent.plist" ]; }
plist() {  # plist <name> <program and arguments...>
  local name=$1; shift
  local args=""; for a in "$@"; do args="$args<string>$a</string>"; done
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$LABEL.$name</string>
<key>UserName</key><string>$(id -un)</string>
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
install_daemon() {  # install_daemon <name>: (re)load $HOSTDIR/<name>.plist as a boot daemon
  sudo cp "$HOSTDIR/$1.plist" "/Library/LaunchDaemons/$LABEL.$1.plist"
  sudo chown root:wheel "/Library/LaunchDaemons/$LABEL.$1.plist"
  sudo launchctl bootout "system/$LABEL.$1" 2>/dev/null || true
  sudo launchctl bootstrap system "/Library/LaunchDaemons/$LABEL.$1.plist"
}
# Replaces the web on 6050 with the release in release.json without a window in which requests fail, and without
# sudo: the daemons run as this user, so launchd restarts the ones this function stops (the same steps as
# apps/web-ecommerce/scripts/deploy-zero-downtime.ps1 on Windows):
#   1. a holding proxy 6049 -> 6050 (hold-proxy.cjs) and a second tunnel connector routed through it;
#   2. the daemon's connector is restarted onto the proxy too, so nothing reaches 6050 directly;
#   3. the web is stopped; launchd starts it on the new release while the proxy holds the requests that arrive;
#   4. the daemon's connector goes back to 6050 and the temporary connector and proxy stop.
switch_web() {
  local cfg="$HOME/.cloudflared/config.yml" work="$RUNTIME/switch" proxy_pid conn_pid web_pid
  healthy() { curl -fsS -m 10 -o /dev/null http://127.0.0.1:6050/api/products/filters; }
  registered_since() { tail -n +"$(($2 + 1))" "$1" 2>/dev/null | grep -c 'Registered tunnel connection' || true; }
  # Stops the daemon's connector (launchd starts it again with the current config) and waits until it is connected.
  restart_connector() {
    local before pid
    before=$(wc -l < "$HOSTDIR/tunnel.log" | tr -d ' ')
    pid=$(pgrep -f -- "--config $cfg tunnel run" || true)
    [ -n "$pid" ] || die 'the tunnel daemon is not running'
    kill $pid
    for _ in $(seq 1 60); do [ "$(registered_since "$HOSTDIR/tunnel.log" "$before")" -ge 1 ] && return 0; sleep 1; done
    die "the tunnel daemon did not reconnect: see $HOSTDIR/tunnel.log"
  }
  healthy || die 'the current web is not healthy; not touching it'
  grep -q '127\.0\.0\.1:6050' "$cfg" || die "$cfg does not route to 127.0.0.1:6050"
  mkdir -p "$work"; : > "$work/connector.log"
  cp -p "$cfg" "$work/config.direct.yml"
  sed 's#127\.0\.0\.1:6050#127.0.0.1:6049#g' "$cfg" > "$work/config.hold.yml"; chmod 600 "$work/config.hold.yml"
  # Whatever happens below, the tunnel configuration ends as it started and the helpers are stopped.
  cleanup() {
    cp -p "$work/config.direct.yml" "$cfg"
    [ -n "${conn_pid:-}" ] && kill "$conn_pid" 2>/dev/null || true
    [ -n "${proxy_pid:-}" ] && { sleep 5; kill "$proxy_pid" 2>/dev/null || true; }
  }
  trap cleanup EXIT
  log 'Switch 1/4: holding proxy and a second tunnel connector'
  "$NODE_BIN/node" "$APP/scripts/hold-proxy.cjs" 6049 6050 "$work/hold-proxy.log" &
  proxy_pid=$!
  "$CLOUDFLARED" --no-autoupdate --config "$work/config.hold.yml" tunnel run model-universe >> "$work/connector.log" 2>&1 &
  conn_pid=$!
  for _ in $(seq 1 60); do [ "$(registered_since "$work/connector.log" 0)" -ge 2 ] && break; sleep 1; done
  [ "$(registered_since "$work/connector.log" 0)" -ge 2 ] || die "the second connector did not connect: see $work/connector.log"
  curl -fsS -m 10 -o /dev/null http://127.0.0.1:6049/api/products/filters || die 'the holding proxy does not reach the web'
  log 'Switch 2/4: the tunnel daemon goes through the proxy'
  cp "$work/config.hold.yml" "$cfg"
  restart_connector
  log 'Switch 3/4: restarting the web on the new release (requests wait in the proxy)'
  web_pid=$(lsof -nP -iTCP:6050 -sTCP:LISTEN -t | head -1)
  [ -n "$web_pid" ] || die 'nothing listens on 6050'
  kill "$web_pid"
  sleep 2
  for _ in $(seq 1 90); do healthy && break; sleep 1; done
  healthy || die "the new web did not become healthy: see $HOSTDIR/web.log (the proxy keeps holding for 90 s)"
  log 'Switch 4/4: the tunnel daemon goes back to the web directly'
  cp -p "$work/config.direct.yml" "$cfg"
  restart_connector
  trap - EXIT
  cleanup
  log "Web switched to $(tr -d '\n ' < "$RUNTIME/release.json"). Requests held: $(grep -c 'connected after' "$work/hold-proxy.log" || true)"
}
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
  # PostgreSQL moves from brew services (only after login) to a boot daemon.
  "$BREW" services stop postgresql@18 >/dev/null 2>&1 || true
  pg_running && "$PG_BIN/pg_ctl" -D "$PGDATA" -m fast -w stop || true
  plist postgres "$PG_BIN/postgres" -D "$PGDATA" > "$HOSTDIR/postgres.plist"
  plist web "$HOSTDIR/run-web.sh" > "$HOSTDIR/web.plist"
  plist tunnel "$CLOUDFLARED" --no-autoupdate --config "$HOME/.cloudflared/config.yml" tunnel run model-universe > "$HOSTDIR/tunnel.plist"
  log 'Installing the boot daemons (sudo asks for your Mac password).'
  for name in postgres web tunnel; do
    install_daemon "$name"
    [ "$name" = postgres ] && sleep 5
  done
  # Awake on power. A MacBook still sleeps when its lid is closed unless an external display is attached:
  # keep the lid open (or use clamshell mode with a display).
  sudo pmset -c sleep 0 disksleep 0 standby 0 autopoweroff 0 powernap 0 womp 1 autorestart 1
  log 'Waiting for https://modeluniverse.vn'
  for _ in $(seq 1 60); do public_up && { log 'modeluniverse.vn answers from this Mac.'; exit 0; }; sleep 5; done
  die "no public answer yet: see $HOSTDIR/web.log and tunnel.log"
  ;;
agent)
  [ -n "$UV" ] || die 'uv is missing: curl -LsSf https://astral.sh/uv/install.sh | sh'
  [ -f "$HOSTDIR/web.plist" ] || die 'run service first'
  [ -f "$AGENT/.env" ] || die "no $AGENT/.env: run restore, or copy .env.example and set LLM_PROFILE and its key"
  pg_running || die 'PostgreSQL is not running'
  PROFILE=$(agentenv LLM_PROFILE)
  [ -n "$PROFILE" ] && [ "$PROFILE" != scripted ] || die "set LLM_PROFILE in $AGENT/.env (google for production)"
  log 'Agent dependencies (uv sync --frozen)'
  (cd "$AGENT" && "$UV" sync --frozen --no-dev --extra runtime --extra market)
  # The agent's own database (checkpoints, knowledge base) and its read-only role on the shop's analytics views.
  # Both SQL files are idempotent and set the password again, so every run rotates the two passwords.
  DB_USER=$(envget DB_USERNAME); DB_PASS=$(envget DB_PASSWORD); DB_NAME=$(envget DB_NAME)
  AGENT_PASS=$(openssl rand -hex 24); READER_PASS=$(openssl rand -hex 24)
  sql() { PGPASSWORD="$DB_PASS" "$PG_BIN/psql" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" "$@" >/dev/null; }
  sql -d postgres -v agent_password="$AGENT_PASS" -f "$ROOT/infra/sql/shop_agent.sql"
  sql -d shop_agent -c 'CREATE EXTENSION IF NOT EXISTS vector'
  sql -d "$DB_NAME" -v web_role="$DB_USER" -v ci_reader_password="$READER_PASS" -f "$ROOT/infra/sql/ci_reader.sql"
  setenv "$AGENT/.env" DATABASE_URL "postgresql://shop_agent:$AGENT_PASS@127.0.0.1:5432/shop_agent"
  setenv "$AGENT/.env" SHOP_READ_DSN "postgresql://ci_reader:$READER_PASS@127.0.0.1:5432/$DB_NAME"
  setenv "$AGENT/.env" SHOP_ADAPTER sql
  setenv "$AGENT/.env" SHOP_API_BASE_URL http://127.0.0.1:6050/api/agent/v1
  setenv "$AGENT/.env" SHOP_API_TOKEN "$(envget AGENT_API_TOKEN)"        # the web checks this token on its Agent API
  setenv "$AGENT/.env" AGENT_ACTOR_SECRET "$(envget AGENT_ACTOR_SECRET)" # the web signs actor tokens with it
  setenv "$AGENT/.env" AGENT_SERVER_URL "$AGENT_URL"                     # Aegra has no in-process loopback (ADR-0013)
  # A profile that embeds with Ollama keeps the Store's semantic index (aegra.json, needs Ollama with bge-m3 here);
  # a hosted profile runs without it (aegra.hosted.json).
  case "$PROFILE" in google*) MANIFEST=aegra.hosted.json ;; *) MANIFEST=aegra.json ;; esac
  # One process, no Redis: a run interrupted by a crash is resent with the same idempotency keys when it is retried.
  # Aegra reads its settings from the environment only; the agent's own settings come from .env in its folder.
  cat > "$HOSTDIR/run-agent.sh" <<EOF
#!/bin/bash
cd "$AGENT"
export APP_ENV=production ENV_MODE=PRODUCTION AUTH_TYPE=custom DEBUG=false LOG_LEVEL=INFO
export HOST=127.0.0.1 PORT=2026 SERVER_URL=$AGENT_URL REDIS_BROKER_ENABLED=false
export AEGRA_CONFIG="$AGENT/$MANIFEST" PYTHONPATH="$AGENT/src" OLLAMA_HOST=http://127.0.0.1:11434
export DATABASE_URL=\$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2-)
export PATH="$AGENT/.venv/bin:/usr/bin:/bin"
exec "$AGENT/.venv/bin/python" -m uvicorn aegra_api.main:app --host 127.0.0.1 --port 2026
EOF
  chmod 755 "$HOSTDIR/run-agent.sh"
  plist agent "$HOSTDIR/run-agent.sh" > "$HOSTDIR/agent.plist"
  log 'Installing the agent daemon (sudo asks for your Mac password).'
  install_daemon agent
  for _ in $(seq 1 60); do curl -fsS -m 5 -o /dev/null "$AGENT_URL/health" && break; sleep 2; done
  curl -fsS -m 5 -o /dev/null "$AGENT_URL/health" || die "the agent did not start: see $HOSTDIR/agent.log"
  log "Agent Server answers on $AGENT_URL ($PROFILE, $MANIFEST)."
  # The web reaches the agent through this URL; it reads .env at start.
  if [ "$(envget AGENT_SERVER_URL)" != "$AGENT_URL" ]; then
    setenv "$APP/.env" AGENT_SERVER_URL "$AGENT_URL"
    sudo launchctl kickstart -k "system/$LABEL.web"
    log 'Web restarted with the agent URL.'
  fi
  cat <<EOF
Next, in $AGENT:
  uv run shop-agent doctor --profile $PROFILE --live   every model role, the embeddings and the decision model answer
  uv run shop-agent ingest                             index the knowledge base (again after changing the embedding model)
  uv run shop-agent sync-crons                         schedule monitor, collect and the briefings (they spend model budget)
EOF
  ;;
deploy)
  build_release
  switch_web
  ;;
redeploy)
  git -C "$ROOT" pull --ff-only
  build_release
  if agent_installed; then
    (cd "$AGENT" && "$UV" sync --frozen --no-dev --extra runtime --extra market)
    sudo launchctl kickstart -k "system/$LABEL.agent"
  fi
  switch_web
  ;;
status)
  names="postgres web tunnel"; if agent_installed; then names="$names agent"; fi
  for name in $names; do sudo launchctl print "system/$LABEL.$name" 2>/dev/null | grep -E '^[[:space:]]*state =' | sed "s/^/$name: /" || echo "$name: not installed"; done
  public_up && echo 'public: 200' || echo 'public: DOWN'
  if agent_installed; then curl -fsS -m 5 -o /dev/null "$AGENT_URL/health" && echo 'agent: 200' || echo 'agent: DOWN'; fi
  ;;
*)
  sed -n '2,23p' "$0"; exit 1
  ;;
esac
