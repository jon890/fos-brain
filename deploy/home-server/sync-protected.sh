#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_DEPLOY_ROOT="${BRAIN_DEPLOY_ROOT:-$SCRIPT_DIR}"
BRAIN_REPO="${BRAIN_REPO:?Set BRAIN_REPO to the public brain checkout.}"
PRIVATE_BRAIN_REPO="${PRIVATE_BRAIN_REPO:?Set PRIVATE_BRAIN_REPO to the private brain checkout.}"
PROTECTED_OUTPUT_ROOT="${PROTECTED_OUTPUT_ROOT:-$BRAIN_REPO/quartz-protected}"
BRAIN_SYNC_LOCK="${BRAIN_SYNC_LOCK:-$BRAIN_DEPLOY_ROOT/sync-protected.lock}"
FLOCK_BIN="${FLOCK_BIN:-flock}"
BUILD_SCRIPT="$BRAIN_DEPLOY_ROOT/build-protected.sh"

fail() {
  echo "$*" >&2
  exit 1
}

verify_checkout() {
  local repo="$1"
  local label="$2"
  local branch

  [[ -d "$repo/.git" ]] || fail "$label repository is missing: $repo"
  [[ -z "$(git -C "$repo" status --porcelain)" ]] || fail "$label repository is not clean."

  branch="$(git -C "$repo" symbolic-ref --quiet --short HEAD)" || fail "$label repository is detached."
  [[ "$branch" == "main" ]] || fail "$label repository must be on main, found: $branch"

  git -C "$repo" fetch --quiet origin main
  git -C "$repo" rev-parse --verify --quiet refs/remotes/origin/main >/dev/null || \
    fail "$label origin/main is missing."
  git -C "$repo" merge-base --is-ancestor HEAD refs/remotes/origin/main || \
    fail "$label repository cannot fast-forward to origin/main."
}

command -v "$FLOCK_BIN" >/dev/null 2>&1 || fail "flock is required: $FLOCK_BIN"
[[ -x "$BUILD_SCRIPT" ]] || fail "Protected build script is missing or not executable: $BUILD_SCRIPT"

mkdir -p "$(dirname "$BRAIN_SYNC_LOCK")"
exec 9>"$BRAIN_SYNC_LOCK"
"$FLOCK_BIN" 9

verify_checkout "$BRAIN_REPO" "Public brain"
verify_checkout "$PRIVATE_BRAIN_REPO" "Private brain"

git -C "$BRAIN_REPO" merge --quiet --ff-only refs/remotes/origin/main
git -C "$PRIVATE_BRAIN_REPO" merge --quiet --ff-only refs/remotes/origin/main

BRAIN_REPO="$BRAIN_REPO" \
PRIVATE_BRAIN_REPO="$PRIVATE_BRAIN_REPO" \
PROTECTED_OUTPUT_ROOT="$PROTECTED_OUTPUT_ROOT" \
  "$BUILD_SCRIPT"
