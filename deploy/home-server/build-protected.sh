#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_REPO="${BRAIN_REPO:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PRIVATE_BRAIN_REPO="${PRIVATE_BRAIN_REPO:-$BRAIN_REPO/private}"
PROTECTED_OUTPUT_ROOT="${PROTECTED_OUTPUT_ROOT:-$BRAIN_REPO/quartz-protected}"
QUARTZ_DIR="$BRAIN_REPO/quartz"
PUBLIC_WIKI="$BRAIN_REPO/wiki"
PRIVATE_WIKI="$PRIVATE_BRAIN_REPO/wiki"

NODE_IMAGE="node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d"
BUILD_UID="${HOST_UID:-$(id -u)}"
BUILD_GID="${HOST_GID:-$(id -g)}"
RENDERER="${PROTECTED_BUILD_RENDERER:-}"
RELEASE_ID="${PROTECTED_RELEASE_ID:-}"

CONTENT_DIR=""
STAGING_RELEASE=""
CURRENT_LINK_TMP=""

cleanup() {
  if [[ -n "$CONTENT_DIR" && -d "$CONTENT_DIR" ]]; then
    rm -rf -- "$CONTENT_DIR"
  fi
  if [[ -n "$STAGING_RELEASE" && -d "$STAGING_RELEASE" ]]; then
    rm -rf -- "$STAGING_RELEASE"
  fi
  if [[ -n "$CURRENT_LINK_TMP" && -L "$CURRENT_LINK_TMP" ]]; then
    rm -f -- "$CURRENT_LINK_TMP"
  fi
}
trap cleanup EXIT

fail() {
  echo "$*" >&2
  exit 1
}

normalize_index() {
  local output_dir="$1"

  if [[ ! -e "$output_dir/index.html" && -s "$output_dir/INDEX.html" ]]; then
    cp "$output_dir/INDEX.html" "$output_dir/index.html"
  fi

  [[ -s "$output_dir/index.html" ]] || fail "Quartz did not emit a lowercase index.html under $output_dir."
}

render_quartz() {
  local content_dir="$1"
  local output_dir="$2"
  local output_parent output_name

  if [[ -n "$RENDERER" ]]; then
    [[ -x "$RENDERER" ]] || fail "PROTECTED_BUILD_RENDERER is not executable: $RENDERER"
    "$RENDERER" "$content_dir" "$output_dir"
    return
  fi

  output_parent="$(dirname "$output_dir")"
  output_name="$(basename "$output_dir")"

  docker run --rm \
    --user "$BUILD_UID:$BUILD_GID" \
    --workdir /workspace/quartz \
    --env HOME=/tmp/quartz-home \
    --env COREPACK_HOME=/tmp/corepack \
    --env CI=true \
    --env "PROTECTED_OUTPUT_NAME=$output_name" \
    --mount "type=bind,src=$QUARTZ_DIR,dst=/workspace/quartz" \
    --mount "type=bind,src=$content_dir,dst=/workspace/content,readonly" \
    --mount "type=bind,src=$output_parent,dst=/workspace/releases" \
    "$NODE_IMAGE" \
    sh -euc '
      mkdir -p "$HOME" "$COREPACK_HOME"
      corepack pnpm@10.33.0 install --frozen-lockfile --store-dir /tmp/pnpm-store
      corepack pnpm@10.33.0 quartz build \
        --directory /workspace/content \
        --output "/workspace/releases/$PROTECTED_OUTPUT_NAME"
    '
}

validate_release() {
  local release_dir="$1"
  local private_markdown_count private_html_count namespace private_page private_relative private_output

  normalize_index "$release_dir"
  normalize_index "$release_dir/_private"
  [[ -s "$release_dir/404.html" ]] || fail "Quartz did not emit 404.html."

  for namespace in concepts topics entities; do
    if find "$PUBLIC_WIKI/$namespace" -type f -name '*.md' -print -quit 2>/dev/null | grep -q .; then
      [[ -d "$release_dir/$namespace" ]] || fail "Public route /$namespace is missing."
    fi
  done

  private_markdown_count="$(find "$PRIVATE_WIKI" -type f -name '*.md' | wc -l | tr -d ' ')"
  private_html_count="$(find "$release_dir/_private" -type f -name '*.html' | wc -l | tr -d ' ')"
  [[ "$private_markdown_count" -gt 0 ]] || fail "The private wiki has no Markdown documents."
  [[ "$private_html_count" -ge "$private_markdown_count" ]] || \
    fail "Private output count is smaller than its Markdown input count."

  while IFS= read -r -d '' private_page; do
    private_relative="${private_page#"$PRIVATE_WIKI/"}"
    private_output="$release_dir/_private/${private_relative%.md}.html"
    [[ -s "$private_output" ]] || fail "Private page output is missing: $private_relative"
  done < <(find "$PRIVATE_WIKI" -type f -name '*.md' -print0)

  for namespace in raw work private; do
    [[ ! -e "$release_dir/$namespace" ]] || fail "Forbidden output path detected: /$namespace"
  done

  if find "$release_dir" -type l -print -quit | grep -q .; then
    fail "Generated releases must not contain symbolic links."
  fi
}

activate_release() {
  local release_name="$1"
  local current_link="$PROTECTED_OUTPUT_ROOT/current"

  CURRENT_LINK_TMP="$PROTECTED_OUTPUT_ROOT/.current.$$.tmp"
  ln -s "releases/$release_name" "$CURRENT_LINK_TMP"

  if mv -Tf "$CURRENT_LINK_TMP" "$current_link" 2>/dev/null; then
    :
  else
    mv -fh "$CURRENT_LINK_TMP" "$current_link"
  fi
  CURRENT_LINK_TMP=""
}

[[ "$BUILD_UID" =~ ^[0-9]+$ && "$BUILD_GID" =~ ^[0-9]+$ ]] || fail "HOST_UID and HOST_GID must be numeric."
[[ -f "$QUARTZ_DIR/pnpm-lock.yaml" ]] || fail "Quartz lockfile is missing under $QUARTZ_DIR."
[[ -d "$PUBLIC_WIKI" ]] || fail "Public wiki is missing: $PUBLIC_WIKI"
[[ -f "$PRIVATE_WIKI/INDEX.md" ]] || fail "Private wiki INDEX is missing: $PRIVATE_WIKI/INDEX.md"

if [[ -z "$RELEASE_ID" ]]; then
  PUBLIC_COMMIT="$(git -C "$BRAIN_REPO" rev-parse --short=12 HEAD 2>/dev/null)" || \
    fail "Cannot resolve the public brain HEAD for the release id."
  PRIVATE_COMMIT="$(git -C "$PRIVATE_BRAIN_REPO" rev-parse --short=12 HEAD 2>/dev/null)" || \
    fail "Cannot resolve the private brain HEAD for the release id."
  RELEASE_ID="$PUBLIC_COMMIT-$PRIVATE_COMMIT-$(date -u +%Y%m%dT%H%M%SZ)"
fi
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "PROTECTED_RELEASE_ID contains unsafe characters."

if find "$PUBLIC_WIKI" "$PRIVATE_WIKI" -type l -print -quit | grep -q .; then
  fail "Wiki input must not contain symbolic links."
fi

mkdir -p "$PROTECTED_OUTPUT_ROOT/releases"
CONTENT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fos-brain-protected-content.XXXXXX")"
cp -a "$PUBLIC_WIKI/." "$CONTENT_DIR/"
mkdir -p "$CONTENT_DIR/_private"
cp -a "$PRIVATE_WIKI/." "$CONTENT_DIR/_private/"

STAGING_RELEASE="$PROTECTED_OUTPUT_ROOT/releases/.$RELEASE_ID.tmp.$$"
FINAL_RELEASE="$PROTECTED_OUTPUT_ROOT/releases/$RELEASE_ID"
[[ ! -e "$STAGING_RELEASE" && ! -e "$FINAL_RELEASE" ]] || fail "Release already exists: $RELEASE_ID"
mkdir "$STAGING_RELEASE"

render_quartz "$CONTENT_DIR" "$STAGING_RELEASE"
validate_release "$STAGING_RELEASE"
mv "$STAGING_RELEASE" "$FINAL_RELEASE"
STAGING_RELEASE=""
activate_release "$RELEASE_ID"

echo "Protected Quartz release activated: $RELEASE_ID"
