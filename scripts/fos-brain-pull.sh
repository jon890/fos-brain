#!/usr/bin/env bash

set -Eeuo pipefail

brain_root="${FOS_BRAIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
private_root="${FOS_BRAIN_PRIVATE_ROOT:-$brain_root/private}"
lock_file="${FOS_BRAIN_LOCK_FILE:-${XDG_RUNTIME_DIR:-/tmp}/fos-brain-pull.lock}"
qmd_container="${FOS_BRAIN_QMD_CONTAINER:-}"

exec 9>"$lock_file"
if ! flock -n 9; then
  echo "다른 fos-brain 동기화가 실행 중이므로 종료한다."
  exit 0
fi

restore_stash() {
  local repo="$1"
  if ! git -C "$repo" stash pop --index 'stash@{0}'; then
    echo "자동 stash 복원 중 충돌이 발생했다: $repo" >&2
    echo "stash와 충돌 파일을 보존했으므로 수동 병합이 필요하다." >&2
    return 1
  fi
}

update_repo() {
  local label="$1"
  local repo="$2"
  local branch
  local stashed=0

  if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "$label 저장소를 찾을 수 없다: $repo" >&2
    return 1
  fi

  branch="$(git -C "$repo" branch --show-current)"
  if [[ "$branch" != "main" ]]; then
    echo "$label 저장소가 main 브랜치가 아니다: $branch" >&2
    return 1
  fi

  if [[ -n "$(git -C "$repo" status --porcelain)" ]]; then
    git -C "$repo" stash push --include-untracked -m "fos-brain-pull 자동 백업 $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    stashed=1
  fi

  if ! git -C "$repo" fetch origin main || ! git -C "$repo" merge --ff-only origin/main; then
    if [[ "$stashed" -eq 1 ]]; then
      restore_stash "$repo" || true
    fi
    echo "$label 저장소를 fast-forward하지 못했다: $repo" >&2
    return 1
  fi

  if [[ "$stashed" -eq 1 ]]; then
    restore_stash "$repo"
  fi

  echo "$label 동기화 완료: $(git -C "$repo" rev-parse --short HEAD)"
}

update_repo public "$brain_root"
update_repo private "$private_root"

if [[ -n "$qmd_container" ]]; then
  docker exec "$qmd_container" qmd update
  docker exec "$qmd_container" qmd embed
  echo "qmd 인덱스 갱신 완료: $qmd_container"
fi
