#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -ne 1 || -z "${1:-}" ]]; then
  echo "usage: $0 <local-static-server-url>" >&2
  exit 2
fi

node "$SCRIPT_DIR/verify-memory-atlas-browser.mjs" "${1%/}"
