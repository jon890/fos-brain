#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="${BRAIN_DEPLOY_ROOT:-/home/bifos/apps/fos-brain-deploy}"
COMPOSE_FILE="${BRAIN_QMD_COMPOSE:-$DEPLOY_ROOT/brain-qmd/compose.yaml}"
DATA_ROOT="${BRAIN_QMD_DATA:-/home/bifos/.brain-qmd}"
SYNC_SCRIPT="${BRAIN_QMD_SYNC_SCRIPT:-$DEPLOY_ROOT/sync-qmd.sh}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"

fail() {
  echo "$*" >&2
  exit 1
}

compose() {
  docker compose --env-file "$DEPLOY_ROOT/.env" --file "$COMPOSE_FILE" "$@"
}

wait_health() {
  local started now status

  started="$(date +%s)"
  while true; do
    status="$(docker inspect brain-qmd --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || true)"
    [[ "$status" == "healthy" ]] && return 0
    [[ "$status" == "unhealthy" || "$status" == "missing" ]] && return 1
    now="$(date +%s)"
    (( now - started < HEALTH_TIMEOUT_SECONDS )) || return 1
    sleep 2
  done
}

database_hash() {
  local count

  count="$(find "$DATA_ROOT" -type f \( \
    -name '*.sqlite' -o -name '*.sqlite-wal' -o -name '*.sqlite-shm' -o -name '*.sqlite-journal' -o \
    -name '*.sqlite3' -o -name '*.sqlite3-wal' -o -name '*.sqlite3-shm' -o -name '*.sqlite3-journal' -o \
    -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.db-journal' \
  \) | wc -l)"
  (( count > 0 )) || fail "No qmd database file was found."
  find "$DATA_ROOT" -type f \( \
    -name '*.sqlite' -o -name '*.sqlite-wal' -o -name '*.sqlite-shm' -o -name '*.sqlite-journal' -o \
    -name '*.sqlite3' -o -name '*.sqlite3-wal' -o -name '*.sqlite3-shm' -o -name '*.sqlite3-journal' -o \
    -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.db-journal' \
  \) -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}'
}

restore_service() {
  compose up -d brain-qmd >/dev/null || return 1
  wait_health
}

[[ "${BRAIN_QMD_RECOVERY_TEST:-0}" == "1" ]] \
  || fail "Set BRAIN_QMD_RECOVERY_TEST=1 to run the live recovery test."
[[ -f "$COMPOSE_FILE" && -x "$SYNC_SCRIPT" ]] || fail "brain-qmd deployment files are missing."

trap 'restore_service || true' EXIT

compose stop brain-qmd >/dev/null
before_hash="$(database_hash)"
restore_service

if BRAIN_QMD_SYNC_MODE=invalid "$SYNC_SCRIPT"; then
  fail "sync-qmd accepted the invalid test mode."
fi
wait_health

compose stop brain-qmd >/dev/null
after_hash="$(database_hash)"
[[ "$after_hash" == "$before_hash" ]] || fail "The qmd database hash changed after recovery."

restore_service
trap - EXIT

echo "live brain-qmd recovery verification passed: $after_hash"
