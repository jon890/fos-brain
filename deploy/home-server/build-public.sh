#!/usr/bin/env bash
set -euo pipefail

normalize_public_index() {
  local public_dir="$1"

  if [[ ! -e "$public_dir/index.html" && -s "$public_dir/INDEX.html" ]]; then
    cp "$public_dir/INDEX.html" "$public_dir/index.html"
  fi

  if [[ ! -s "$public_dir/index.html" ]]; then
    echo "Quartz did not emit a deployable lowercase index.html." >&2
    return 1
  fi
}

if [[ "${BUILD_PUBLIC_NORMALIZE_ONLY:-}" == "1" ]]; then
  normalize_public_index "${1:?Pass the public output directory.}"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
QUARTZ_DIR="$REPO_ROOT/quartz"
WIKI_DIR="$REPO_ROOT/wiki"

NODE_IMAGE="node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d"
BUILD_UID="${HOST_UID:-$(id -u)}"
BUILD_GID="${HOST_GID:-$(id -g)}"

if [[ ! "$BUILD_UID" =~ ^[0-9]+$ || ! "$BUILD_GID" =~ ^[0-9]+$ ]]; then
  echo "HOST_UID and HOST_GID must be numeric." >&2
  exit 1
fi

if [[ ! -f "$QUARTZ_DIR/pnpm-lock.yaml" || ! -d "$WIKI_DIR" ]]; then
  echo "Quartz or public wiki input is missing under $REPO_ROOT." >&2
  exit 1
fi

docker run --rm \
  --user "$BUILD_UID:$BUILD_GID" \
  --workdir /workspace/quartz \
  --env HOME=/tmp/quartz-home \
  --env COREPACK_HOME=/tmp/corepack \
  --env CI=true \
  --mount "type=bind,src=$QUARTZ_DIR,dst=/workspace/quartz" \
  --mount "type=bind,src=$WIKI_DIR,dst=/workspace/wiki,readonly" \
  "$NODE_IMAGE" \
  sh -euc '
    mkdir -p "$HOME" "$COREPACK_HOME"
    corepack pnpm@10.33.0 install --frozen-lockfile --store-dir /tmp/pnpm-store
    corepack pnpm@10.33.0 quartz build --directory /workspace/wiki --output /workspace/quartz/public
  '

normalize_public_index "$QUARTZ_DIR/public"
