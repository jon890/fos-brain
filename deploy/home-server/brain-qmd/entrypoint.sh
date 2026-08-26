#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-serve}"
QMD_BIN="${QMD_BIN:-qmd}"
QMD_PORT="${QMD_PORT:-8181}"

EXPECTED_COLLECTIONS=(
  "brain-wiki:/brain/public/wiki"
  "brain-raw:/brain/public/raw"
  "brain-private:/brain/private/wiki"
)

fail() {
  echo "$*" >&2
  exit 1
}

require_dir() {
  local collection="$1"
  local directory="$2"

  [[ -d "$directory" ]] || fail "$collection directory is missing: $directory"
  [[ ! -L "$directory" ]] || fail "$collection directory must not be a symbolic link: $directory"
}

collection_has_expected_path() {
  local collection="$1"
  local directory="$2"
  local output="$3"

  printf '%s\n' "$output" | grep -F "Collection: $collection" >/dev/null 2>&1 \
    && printf '%s\n' "$output" | grep -F "Path:     $directory" >/dev/null 2>&1 \
    && printf '%s\n' "$output" | grep -F 'Pattern:  **/*.md' >/dev/null 2>&1 \
    && printf '%s\n' "$output" | grep -F 'Include:  yes (default)' >/dev/null 2>&1
}

ensure_collection() {
  local collection="$1"
  local directory="$2"
  local output

  if output="$("$QMD_BIN" collection show "$collection" 2>/dev/null)"; then
    collection_has_expected_path "$collection" "$directory" "$output" \
      || fail "$collection exists with an unexpected path or mask. Refusing to continue."
    return
  fi

  "$QMD_BIN" collection add "$directory" --name "$collection" --mask '**/*.md' >/dev/null
  output="$("$QMD_BIN" collection show "$collection")"
  collection_has_expected_path "$collection" "$directory" "$output" \
    || fail "$collection was not registered with expected path: $directory"
}

reject_unexpected_collections() {
  local output line collection

  output="$("$QMD_BIN" collection list)"
  while IFS= read -r line; do
    if [[ "$line" =~ ^([^[:space:]]+)[[:space:]]+\(qmd:// ]]; then
      collection="${BASH_REMATCH[1]}"
      case "$collection" in
        brain-wiki|brain-raw|brain-private) ;;
        *) fail "Unexpected collection is registered: $collection" ;;
      esac
    fi
  done <<< "$output"
}

validate_collections() {
  local spec collection directory

  for spec in "${EXPECTED_COLLECTIONS[@]}"; do
    collection="${spec%%:*}"
    directory="${spec#*:}"
    require_dir "$collection" "$directory"
    ensure_collection "$collection" "$directory"
  done

  reject_unexpected_collections
}

run_status() {
  "$QMD_BIN" --version
  "$QMD_BIN" collection list
  "$QMD_BIN" status
}

run_sync() {
  local spec collection

  "$QMD_BIN" update
  for spec in "${EXPECTED_COLLECTIONS[@]}"; do
    collection="${spec%%:*}"
    "$QMD_BIN" embed -c "$collection" --max-docs-per-batch "${QMD_EMBED_BATCH_SIZE:-8}"
  done
}

case "$MODE" in
  serve)
    validate_collections
    exec "$QMD_BIN" mcp --http --host 0.0.0.0 --port "$QMD_PORT"
    ;;
  sync)
    validate_collections
    run_sync
    ;;
  status)
    validate_collections
    run_status
    ;;
  *)
    fail "Unsupported mode: $MODE"
    ;;
esac
