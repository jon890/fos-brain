#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$TEST_DIR/.." && pwd)"
QMD_DIR="$DEPLOY_DIR/brain-qmd"
TEST_ROOT="$TEST_DIR/.tmp-brain-qmd.$$"
COMPOSE_CONFIG="$TEST_ROOT/compose-config.yaml"
FAKE_BIN="$TEST_ROOT/bin"
FAKE_LOG="$TEST_ROOT/docker.log"
DATA_ROOT="$TEST_ROOT/data"

file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

cleanup() {
  local exit_code=$?

  rm -rf -- "$TEST_ROOT" || exit_code=1
  exit "$exit_code"
}
trap cleanup EXIT

mkdir -p \
  "$TEST_ROOT/public/wiki" \
  "$TEST_ROOT/public/raw" \
  "$TEST_ROOT/private/wiki" \
  "$TEST_ROOT/private/raw" \
  "$DATA_ROOT/nested" \
  "$FAKE_BIN"

printf '# Public\n' > "$TEST_ROOT/public/wiki/INDEX.md"
printf 'PUBLIC_RAW_SENTINEL\n' > "$TEST_ROOT/public/raw/source.txt"
printf '# Private\n' > "$TEST_ROOT/private/wiki/INDEX.md"
printf 'PRIVATE_RAW_SENTINEL\n' > "$TEST_ROOT/private/raw/secret.txt"
printf 'OLD_SQLITE\n' > "$DATA_ROOT/index.sqlite"
printf 'OLD_WAL\n' > "$DATA_ROOT/index.sqlite-wal"
printf 'OLD_SHM\n' > "$DATA_ROOT/index.sqlite-shm"
printf 'OLD_DB\n' > "$DATA_ROOT/nested/cache.db"
printf 'OLD_DB_WAL\n' > "$DATA_ROOT/nested/cache.db-wal"

BRAIN_REPO="$TEST_ROOT/public" \
PRIVATE_BRAIN_REPO="$TEST_ROOT/private" \
  docker compose --file "$QMD_DIR/compose.yaml" config > "$COMPOSE_CONFIG"

if grep -Eq '^[[:space:]]+ports:' "$COMPOSE_CONFIG"; then
  echo "brain-qmd compose must not publish host ports." >&2
  exit 1
fi

grep -Fq 'brain-search-net' "$COMPOSE_CONFIG"
grep -Fq 'QMD_ALLOWED_HOSTS: brain-qmd,brain-qmd:8181,localhost,localhost:8181,127.0.0.1,127.0.0.1:8181' "$COMPOSE_CONFIG"
grep -Fq 'XDG_CONFIG_HOME: /data/config' "$COMPOSE_CONFIG"
grep -Fq 'XDG_CACHE_HOME: /data/cache' "$COMPOSE_CONFIG"
grep -Fq 'target: /data' "$COMPOSE_CONFIG"
grep -Fq 'target: /brain/public/wiki' "$COMPOSE_CONFIG"
grep -Fq 'target: /brain/public/raw' "$COMPOSE_CONFIG"
grep -Fq 'target: /brain/private/wiki' "$COMPOSE_CONFIG"
grep -Fq 'read_only: true' "$COMPOSE_CONFIG"
grep -Fq 'cpus: 2' "$COMPOSE_CONFIG"
grep -Fq 'mem_limit: "4294967296"' "$COMPOSE_CONFIG"
grep -Fq '/health' "$COMPOSE_CONFIG"
if grep -Fq '/brain/private/raw' "$COMPOSE_CONFIG" || grep -Fq 'PRIVATE_RAW_SENTINEL' "$COMPOSE_CONFIG"; then
  echo "private raw must not be mounted or printed." >&2
  exit 1
fi

grep -Fq 'FROM node:24.15.0-bookworm-slim@sha256:152aceace5c03e2597988763165ee33e3fd3633636db0fc983cd2e126b02cfde' "$QMD_DIR/Dockerfile"
grep -Fq 'npm install --global @tobilu/qmd@2.8.3' "$QMD_DIR/Dockerfile"
grep -Fq 'USER 1000:1000' "$QMD_DIR/Dockerfile"
grep -Fq 'XDG_CONFIG_HOME=/data/config' "$QMD_DIR/Dockerfile"
grep -Fq 'XDG_CACHE_HOME=/data/cache' "$QMD_DIR/Dockerfile"
# entrypoint의 런타임 변수를 문자열로 검증한다.
# shellcheck disable=SC2016
grep -Fq 'exec "$QMD_BIN" mcp --http --host 0.0.0.0 --port "$QMD_PORT"' "$QMD_DIR/entrypoint.sh"
grep -Fq 'Unexpected collection is registered' "$QMD_DIR/entrypoint.sh"
grep -Fq "Pattern:  **/*.md" "$QMD_DIR/entrypoint.sh"
grep -Fq 'Include:  yes (default)' "$QMD_DIR/entrypoint.sh"
grep -Fq -- "--mask '**/*.md'" "$QMD_DIR/entrypoint.sh"
grep -Fq "catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE')" "$DEPLOY_DIR/jenkins/sync-brain-job.xml"

cat > "$FAKE_BIN/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> "${FAKE_DOCKER_LOG:?}"

if [[ "$1" == "compose" ]]; then
  shift
  while [[ "$1" == "--file" ]]; do
    shift 2
  done
  case "$1" in
    stop)
      printf 'stopped\n' >> "$FAKE_DOCKER_LOG"
      exit 0
      ;;
    run)
      if [[ "${FAKE_DOCKER_SYNC_FAIL:-0}" == "1" ]]; then
        printf 'sync failed without private body\n' >&2
        exit 42
      fi
      printf 'NEW_SQLITE\n' > "${FAKE_QMD_DATA:?}/index.sqlite"
      printf 'NEW_WAL\n' > "$FAKE_QMD_DATA/index.sqlite-wal"
      printf 'NEW_SHM\n' > "$FAKE_QMD_DATA/index.sqlite-shm"
      printf 'NEW_DB\n' > "$FAKE_QMD_DATA/nested/cache.db"
      printf 'NEW_DB_WAL\n' > "$FAKE_QMD_DATA/nested/cache.db-wal"
      exit 0
      ;;
    up)
      printf 'started\n' >> "$FAKE_DOCKER_LOG"
      exit 0
      ;;
    ps)
      printf 'brain-qmd-container\n'
      exit 0
      ;;
    *)
      echo "unexpected docker compose command: $*" >&2
      exit 64
      ;;
  esac
fi

if [[ "$1" == "inspect" ]]; then
  if [[ "${FAKE_DOCKER_UNHEALTHY:-0}" == "1" ]]; then
    printf 'starting\n'
  else
    printf 'healthy\n'
  fi
  exit 0
fi

echo "unexpected docker command: $*" >&2
exit 64
FAKE_DOCKER
chmod +x "$FAKE_BIN/docker"

cat > "$FAKE_BIN/flock" <<'FAKE_FLOCK'
#!/usr/bin/env bash
set -euo pipefail

[[ "${1:-}" == "9" ]]
FAKE_FLOCK
chmod +x "$FAKE_BIN/flock"

PATH="$FAKE_BIN:$PATH" \
DOCKER_BIN="$FAKE_BIN/docker" \
FLOCK_BIN="$FAKE_BIN/flock" \
FAKE_DOCKER_LOG="$FAKE_LOG" \
FAKE_QMD_DATA="$DATA_ROOT" \
BRAIN_QMD_COMPOSE="$QMD_DIR/compose.yaml" \
BRAIN_QMD_DATA="$DATA_ROOT" \
BRAIN_QMD_LOCK="$TEST_ROOT/sync.lock" \
BRAIN_QMD_UID="$(id -u)" \
BRAIN_QMD_GID="$(id -g)" \
HEALTH_TIMEOUT_SECONDS=4 \
  "$DEPLOY_DIR/sync-qmd.sh" > "$TEST_ROOT/sync-success.out"

grep -Fq 'stop brain-qmd' "$FAKE_LOG"
grep -Fq 'run --rm brain-qmd sync' "$FAKE_LOG"
grep -Fq 'up -d brain-qmd' "$FAKE_LOG"
grep -Fq 'brain-qmd sync completed.' "$TEST_ROOT/sync-success.out"
grep -Fq 'NEW_SQLITE' "$DATA_ROOT/index.sqlite"
grep -Fq 'NEW_WAL' "$DATA_ROOT/index.sqlite-wal"
grep -Fq 'NEW_SHM' "$DATA_ROOT/index.sqlite-shm"
grep -Fq 'NEW_DB' "$DATA_ROOT/nested/cache.db"
grep -Fq 'NEW_DB_WAL' "$DATA_ROOT/nested/cache.db-wal"
[[ "$(file_mode "$DATA_ROOT")" == "700" ]]

printf 'OLD_SQLITE\n' > "$DATA_ROOT/index.sqlite"
printf 'OLD_WAL\n' > "$DATA_ROOT/index.sqlite-wal"
printf 'OLD_SHM\n' > "$DATA_ROOT/index.sqlite-shm"
printf 'OLD_DB\n' > "$DATA_ROOT/nested/cache.db"
printf 'OLD_DB_WAL\n' > "$DATA_ROOT/nested/cache.db-wal"
: > "$FAKE_LOG"

if PATH="$FAKE_BIN:$PATH" \
  DOCKER_BIN="$FAKE_BIN/docker" \
  FLOCK_BIN="$FAKE_BIN/flock" \
  FAKE_DOCKER_LOG="$FAKE_LOG" \
  FAKE_DOCKER_SYNC_FAIL=1 \
  FAKE_QMD_DATA="$DATA_ROOT" \
  BRAIN_QMD_COMPOSE="$QMD_DIR/compose.yaml" \
  BRAIN_QMD_DATA="$DATA_ROOT" \
  BRAIN_QMD_LOCK="$TEST_ROOT/sync.lock" \
  BRAIN_QMD_UID="$(id -u)" \
  BRAIN_QMD_GID="$(id -g)" \
  HEALTH_TIMEOUT_SECONDS=4 \
    "$DEPLOY_DIR/sync-qmd.sh" > "$TEST_ROOT/sync-fail.out" 2> "$TEST_ROOT/sync-fail.err"; then
  echo "sync-qmd accepted a failed sync." >&2
  exit 1
fi

grep -Fq 'OLD_SQLITE' "$DATA_ROOT/index.sqlite"
grep -Fq 'OLD_WAL' "$DATA_ROOT/index.sqlite-wal"
grep -Fq 'OLD_SHM' "$DATA_ROOT/index.sqlite-shm"
grep -Fq 'OLD_DB' "$DATA_ROOT/nested/cache.db"
grep -Fq 'OLD_DB_WAL' "$DATA_ROOT/nested/cache.db-wal"
grep -Fq 'up -d brain-qmd' "$FAKE_LOG"
if grep -R -I -F 'PRIVATE_RAW_SENTINEL' "$TEST_ROOT/sync-fail.out" "$TEST_ROOT/sync-fail.err" "$FAKE_LOG"; then
  echo "private raw content leaked to sync logs." >&2
  exit 1
fi

: > "$FAKE_LOG"
if PATH="$FAKE_BIN:$PATH" \
  DOCKER_BIN="$FAKE_BIN/docker" \
  FLOCK_BIN="$FAKE_BIN/flock" \
  FAKE_DOCKER_LOG="$FAKE_LOG" \
  FAKE_DOCKER_UNHEALTHY=1 \
  FAKE_QMD_DATA="$DATA_ROOT" \
  BRAIN_QMD_COMPOSE="$QMD_DIR/compose.yaml" \
  BRAIN_QMD_DATA="$DATA_ROOT" \
  BRAIN_QMD_LOCK="$TEST_ROOT/sync.lock" \
  BRAIN_QMD_UID="$(id -u)" \
  BRAIN_QMD_GID="$(id -g)" \
  HEALTH_TIMEOUT_SECONDS=1 \
    "$DEPLOY_DIR/sync-qmd.sh" > "$TEST_ROOT/health-timeout.out" 2> "$TEST_ROOT/health-timeout.err"; then
  echo "sync-qmd accepted an unhealthy restarted container." >&2
  exit 1
fi
grep -Fq 'Timed out waiting for brain-qmd health.' "$TEST_ROOT/health-timeout.err"
grep -Fq 'brain-qmd health failed after sync; restoring the previous index.' "$TEST_ROOT/health-timeout.err"
grep -Fq 'OLD_SQLITE' "$DATA_ROOT/index.sqlite"
grep -Fq 'OLD_WAL' "$DATA_ROOT/index.sqlite-wal"
grep -Fq 'OLD_SHM' "$DATA_ROOT/index.sqlite-shm"
grep -Fq 'OLD_DB' "$DATA_ROOT/nested/cache.db"
grep -Fq 'OLD_DB_WAL' "$DATA_ROOT/nested/cache.db-wal"

echo "brain-qmd verification passed."
