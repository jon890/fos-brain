#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_DEPLOY_ROOT="${BRAIN_DEPLOY_ROOT:-$SCRIPT_DIR}"
BRAIN_QMD_COMPOSE="${BRAIN_QMD_COMPOSE:-$BRAIN_DEPLOY_ROOT/brain-qmd/compose.yaml}"
BRAIN_QMD_DATA="${BRAIN_QMD_DATA:-/home/bifos/.brain-qmd}"
BRAIN_QMD_LOCK="${BRAIN_QMD_LOCK:-$BRAIN_DEPLOY_ROOT/sync-qmd.lock}"
BRAIN_QMD_SERVICE="${BRAIN_QMD_SERVICE:-brain-qmd}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
FLOCK_BIN="${FLOCK_BIN:-flock}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-120}"
BRAIN_QMD_UID="${BRAIN_QMD_UID:-1000}"
BRAIN_QMD_GID="${BRAIN_QMD_GID:-1000}"
RUN_MODE="${1:-sync}"
SYNC_CONTAINER_MODE="sync"

BACKUP_DIR=""
SYNC_FAILED=0
SYNC_COMPLETED=0

fail() {
  echo "$*" >&2
  exit 1
}

compose() {
  if [[ -f "$BRAIN_DEPLOY_ROOT/.env" ]]; then
    "$DOCKER_BIN" compose --env-file "$BRAIN_DEPLOY_ROOT/.env" --file "$BRAIN_QMD_COMPOSE" "$@"
  else
    "$DOCKER_BIN" compose --file "$BRAIN_QMD_COMPOSE" "$@"
  fi
}

sqlite_files() {
  find "$BRAIN_QMD_DATA" -type f \( \
    -name '*.sqlite' -o -name '*.sqlite-wal' -o -name '*.sqlite-shm' -o -name '*.sqlite-journal' -o \
    -name '*.sqlite3' -o -name '*.sqlite3-wal' -o -name '*.sqlite3-shm' -o -name '*.sqlite3-journal' -o \
    -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' -o -name '*.db-journal' \
  \) -print 2>/dev/null
}

file_uid() {
  stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1"
}

file_gid() {
  stat -c '%g' "$1" 2>/dev/null || stat -f '%g' "$1"
}

ensure_data_directory() {
  local actual_uid actual_gid

  mkdir -p "$BRAIN_QMD_DATA"
  actual_uid="$(file_uid "$BRAIN_QMD_DATA")"
  actual_gid="$(file_gid "$BRAIN_QMD_DATA")"
  [[ "$actual_uid" == "$BRAIN_QMD_UID" && "$actual_gid" == "$BRAIN_QMD_GID" ]] \
    || fail "brain-qmd data directory must be owned by $BRAIN_QMD_UID:$BRAIN_QMD_GID"
  chmod 0700 "$BRAIN_QMD_DATA"
}

backup_sqlite() {
  BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/brain-qmd-sqlite-backup.XXXXXX")"
  if [[ -d "$BRAIN_QMD_DATA" ]]; then
    while IFS= read -r file; do
      relative="${file#"$BRAIN_QMD_DATA/"}"
      mkdir -p "$BACKUP_DIR/$(dirname "$relative")"
      cp -p "$file" "$BACKUP_DIR/$relative"
    done < <(sqlite_files)
  fi
}

restore_sqlite() {
  local file relative backup

  [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || return 0
  while IFS= read -r file; do
    rm -f -- "$file"
  done < <(sqlite_files)
  while IFS= read -r backup; do
    relative="${backup#"$BACKUP_DIR/"}"
    mkdir -p "$BRAIN_QMD_DATA/$(dirname "$relative")"
    cp -p "$backup" "$BRAIN_QMD_DATA/$relative"
  done < <(find "$BACKUP_DIR" -type f -print)
}

cleanup() {
  local exit_code=$?

  if [[ "$SYNC_FAILED" == "1" ]]; then
    restore_sqlite || true
  fi

  if ! compose up -d "$BRAIN_QMD_SERVICE" >/dev/null || ! wait_health; then
    exit_code=1
    if [[ "$SYNC_COMPLETED" == "1" && "$SYNC_FAILED" == "0" ]]; then
      echo "brain-qmd health failed after sync; restoring the previous index." >&2
      if compose stop "$BRAIN_QMD_SERVICE" >/dev/null \
        && restore_sqlite \
        && compose up -d "$BRAIN_QMD_SERVICE" >/dev/null; then
        wait_health || exit_code=1
      else
        echo "brain-qmd index restore could not be completed safely." >&2
      fi
    fi
  fi

  if [[ -n "$BACKUP_DIR" ]]; then
    rm -rf -- "$BACKUP_DIR" || exit_code=1
  fi

  exit "$exit_code"
}

wait_health() {
  local container started now status

  started="$(date +%s)"
  while true; do
    container="$(compose ps -q "$BRAIN_QMD_SERVICE" 2>/dev/null || true)"
    if [[ -n "$container" ]]; then
      status="$("$DOCKER_BIN" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing-healthcheck{{end}}' "$container" 2>/dev/null || true)"
      [[ "$status" == "healthy" ]] && return 0
      if [[ "$status" == "unhealthy" || "$status" == "missing-healthcheck" ]]; then
        echo "brain-qmd healthcheck failed: $status" >&2
        return 1
      fi
    fi

    now="$(date +%s)"
    if (( now - started >= HEALTH_TIMEOUT_SECONDS )); then
      echo "Timed out waiting for brain-qmd health." >&2
      return 1
    fi
    sleep 2
  done
}

command -v "$FLOCK_BIN" >/dev/null 2>&1 || fail "flock is required: $FLOCK_BIN"
[[ -f "$BRAIN_QMD_COMPOSE" ]] || fail "brain-qmd compose file is missing: $BRAIN_QMD_COMPOSE"
[[ "$RUN_MODE" == "sync" || "$RUN_MODE" == "status" || "$RUN_MODE" == "--status" ]] \
  || fail "Usage: sync-qmd.sh [sync|--status]"
if [[ -n "${BRAIN_QMD_SYNC_MODE:-}" ]]; then
  [[ "${BRAIN_QMD_RECOVERY_TEST:-0}" == "1" && "$BRAIN_QMD_SYNC_MODE" == "invalid" ]] \
    || fail "BRAIN_QMD_SYNC_MODE is reserved for the explicit recovery test."
  SYNC_CONTAINER_MODE="$BRAIN_QMD_SYNC_MODE"
fi
ensure_data_directory
mkdir -p "$(dirname "$BRAIN_QMD_LOCK")"

if [[ "$RUN_MODE" == "status" || "$RUN_MODE" == "--status" ]]; then
  compose run --rm "$BRAIN_QMD_SERVICE" status
  exit 0
fi

exec 9>"$BRAIN_QMD_LOCK"
"$FLOCK_BIN" 9

trap cleanup EXIT

compose stop "$BRAIN_QMD_SERVICE" >/dev/null
backup_sqlite
if ! compose run --rm "$BRAIN_QMD_SERVICE" "$SYNC_CONTAINER_MODE"; then
  SYNC_FAILED=1
  exit 1
fi
SYNC_COMPLETED=1

echo "brain-qmd sync completed."
