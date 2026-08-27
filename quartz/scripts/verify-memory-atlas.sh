#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUARTZ_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${MEMORY_ATLAS_VERIFY_PORT:-8096}"
WS_PORT="${MEMORY_ATLAS_VERIFY_WS_PORT:-3096}"
BASE_URL="http://127.0.0.1:$PORT"
EVIDENCE_DIR="${MEMORY_ATLAS_VERIFY_LOG_DIR:-/tmp/fos-brain-memory-atlas-suite}"
SERVER_LOG="$EVIDENCE_DIR/quartz-server.log"
SERVER_PID=""

stop_server() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  SERVER_PID=""
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  stop_server
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

fail() {
  echo "Memory Atlas verification failed: $*" >&2
  if [[ -f "$SERVER_LOG" ]]; then
    echo "Quartz server log: $SERVER_LOG" >&2
  fi
  exit 1
}

wait_for_server() {
  local attempts=0
  while ((attempts < 120)); do
    if curl -fsS "$BASE_URL/" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      fail "the Quartz server exited before becoming ready"
    fi
    attempts=$((attempts + 1))
    sleep 0.5
  done
  fail "the Quartz server did not become ready at $BASE_URL"
}

if curl -fsS "$BASE_URL/" >/dev/null 2>&1; then
  fail "port $PORT is already serving HTTP; set MEMORY_ATLAS_VERIFY_PORT to an unused port"
fi
if nc -z 127.0.0.1 "$WS_PORT" >/dev/null 2>&1; then
  fail "port $WS_PORT is already in use; set MEMORY_ATLAS_VERIFY_WS_PORT to an unused port"
fi

mkdir -p "$EVIDENCE_DIR"
: >"$SERVER_LOG"

cd "$QUARTZ_DIR"

echo "[1/5] Formatting"
pnpm exec prettier --check \
  quartz.layout.ts \
  quartz/components/MemoryAtlas.tsx \
  quartz/components/renderPage.tsx \
  quartz/components/scripts/memoryAtlas.inline.ts \
  quartz/components/scripts/memoryAtlasRuntime.ts \
  quartz/components/styles/memoryAtlas.scss

echo "[2/5] Type checking"
pnpm exec tsc --noEmit

echo "[3/5] Unit tests"
pnpm test

echo "[4/5] Quartz build and local server"
node --no-deprecation ./quartz/bootstrap-cli.mjs build --serve --port "$PORT" --wsPort "$WS_PORT" \
  >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
wait_for_server

echo "[5/5] Browser, state, layout, and privacy regression"
AB_TIMEOUT_SECONDS="${AB_TIMEOUT_SECONDS:-45}" \
  bash "$SCRIPT_DIR/verify-memory-atlas-browser.sh" "$BASE_URL"

stop_server
for _ in {1..20}; do
  if ! nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 && ! nc -z 127.0.0.1 "$WS_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 || nc -z 127.0.0.1 "$WS_PORT" >/dev/null 2>&1; then
  fail "the temporary Quartz server did not release ports $PORT and $WS_PORT"
fi

echo "Memory Atlas verification passed."
echo "Suite log: $SERVER_LOG"
echo "Browser evidence: /tmp/fos-brain-memory-atlas-plan4"
