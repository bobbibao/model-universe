#!/usr/bin/env bash
# Keeps the cloud-hosted shop up (started by start-cloud.sh): restarts the web or the tunnel when they die and pushes an
# encrypted backup (database + uploads) to the private hand-off repo every hour (branch `cloud-backup`).
STATE=${MU_STATE_DIR:?}; APP=${MU_APP:?}
REMOTE="https://x-access-token:${MU_HANDOFF_TOKEN}@github.com/${MU_HANDOFF_REPO}.git"
log() { echo "[$(date -u +%FT%TZ)] $*" >>"$STATE/watchdog.log"; }
envget() { grep -E "^$1=" "$APP/.env" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

# push_bundle <branch>: dump the database and uploads, encrypt, force-push as the branch's only commit.
push_bundle() {
  local branch=$1 work; work=$(mktemp -d)
  mkdir -p "$work/bundle"
  PGPASSWORD="$(envget DB_PASSWORD)" pg_dump -h 127.0.0.1 -p "$(envget DB_PORT)" -U "$(envget DB_USERNAME)" -d "$(envget DB_NAME)" \
    --no-owner --no-privileges -f "$work/bundle/db.sql" || { log "backup dump failed"; rm -rf "$work"; return 1; }
  cp -r "$APP/uploads" "$work/bundle/uploads"
  local epoch; epoch=$(date -u +%s)
  echo "{\"epoch\": $epoch, \"source\": \"cloud\"}" >"$work/bundle/meta.json"
  mkdir -p "$work/git"
  tar -czf - -C "$work/bundle" . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:MU_BUNDLE_KEY -out "$work/git/bundle.enc"
  echo -n "$epoch" >"$work/git/READY"
  (cd "$work/git" && git init -q -b "$branch" && git add . && git -c user.name=cloud -c user.email=cloud@localhost commit -qm "$branch $epoch" &&
    git push -q --force "$REMOTE" "$branch") && log "pushed $branch $epoch" || log "push $branch failed"
  rm -rf "$work"
}
[ "${1:-}" = "--push" ] && { push_bundle "$2"; exit; }

last_backup=0
while [ ! -f "$STATE/stop" ]; do
  if ! curl -fsS -m 15 -o /dev/null http://127.0.0.1:6050/api/products/filters; then
    sleep 20
    if ! curl -fsS -m 15 -o /dev/null http://127.0.0.1:6050/api/products/filters; then
      log 'web down: restarting'
      pkill -f 'dist/.next/server.js'; sleep 2
      setsid nohup "$STATE/run-web.sh" >/dev/null 2>&1 < /dev/null &
    fi
  fi
  if ! pgrep -f 'cloudflared .*tunnel run' >/dev/null; then
    log 'tunnel down: restarting'
    setsid nohup "$STATE/run-tunnel.sh" >/dev/null 2>&1 < /dev/null &
  fi
  if [ $(( $(date +%s) - last_backup )) -ge 3600 ]; then push_bundle cloud-backup && last_backup=$(date +%s); fi
  sleep 60
done
log 'stopped'
