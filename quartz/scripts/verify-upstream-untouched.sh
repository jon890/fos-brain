#!/usr/bin/env bash
set -Eeuo pipefail

# 이 스크립트는 Quartz fork 경계(ADR-012)를 검사한다.
# quartz/quartz/ 와 quartz/ 루트의 업스트림 파일이 복사 시점 커밋과
# 여전히 같은지, 그리고 quartz/quartz/ 아래 새 파일이 생기지 않았는지 확인한다.
#
# 경로 표기 규칙(작업 항목 3 참고): 이 스크립트 안에서 업스트림 기준 경로 P 는
# 이 저장소의 <REPO_ROOT>/quartz/P 에 대응한다.

# 복사 시점 커밋. quartz-upstream remote 를 fetch 해야 존재한다.
UPSTREAM_BASE="d25a6eabf96751ffca56f8a8139272def7a65041"

REPO_ROOT="$(git rev-parse --show-toplevel)"
QUARTZ_ROOT="$REPO_ROOT/quartz"

if ! git -C "$REPO_ROOT" cat-file -e "$UPSTREAM_BASE" 2>/dev/null; then
  echo "기준 커밋 $UPSTREAM_BASE 를 찾을 수 없다. quartz-upstream remote 를 fetch 한다:" >&2
  echo "  git remote add quartz-upstream https://github.com/jackyzha0/quartz.git" >&2
  echo "  git fetch quartz-upstream" >&2
  exit 2
fi

# 예외 경로(업스트림 기준). 이 파일들은 사용자 편집을 전제하거나
# 이 저장소의 도구 설정이라 검사에서 뺀다.
EXCEPTIONS=(
  "quartz.config.ts"
  "quartz.layout.ts"
  "quartz/styles/custom.scss"
  ".npmrc"
  ".prettierignore"
  "package.json"
)

is_exception() {
  local path="$1"
  local exc
  for exc in "${EXCEPTIONS[@]}"; do
    [[ "$path" == "$exc" ]] && return 0
  done
  return 1
}

violations=()

# 1) 복사 시점 커밋의 quartz/ 트리에 있는 모든 파일과 비교한다.
while IFS= read -r rel; do
  upstream_path="quartz/$rel"
  is_exception "$upstream_path" && continue
  repo_path="$QUARTZ_ROOT/quartz/$rel"
  if [[ ! -f "$repo_path" ]]; then
    violations+=("삭제: $upstream_path")
  elif ! diff -q <(git -C "$REPO_ROOT" show "$UPSTREAM_BASE:quartz/$rel") "$repo_path" >/dev/null 2>&1; then
    violations+=("수정: $upstream_path")
  fi
done < <(git -C "$REPO_ROOT" ls-tree -r --name-only "$UPSTREAM_BASE" -- quartz/ | sed 's#^quartz/##')

# 2) 복사 시점 커밋의 루트 파일(블롭만, 디렉터리 제외) 중
#    이 저장소의 quartz/ 에 있는 것과 비교한다.
while IFS=$'\t' read -r type rel; do
  [[ "$type" == "blob" ]] || continue
  upstream_path="$rel"
  is_exception "$upstream_path" && continue
  repo_path="$QUARTZ_ROOT/$rel"
  [[ -f "$repo_path" ]] || continue
  if ! diff -q <(git -C "$REPO_ROOT" show "$UPSTREAM_BASE:$rel") "$repo_path" >/dev/null 2>&1; then
    violations+=("수정: $upstream_path")
  fi
done < <(git -C "$REPO_ROOT" ls-tree "$UPSTREAM_BASE" -- . | awk '{print $2"\t"$4}')

# 3) 이 저장소가 quartz/quartz/ 아래 새로 만든 파일을 잡는다.
while IFS= read -r rel; do
  if ! git -C "$REPO_ROOT" cat-file -e "$UPSTREAM_BASE:quartz/$rel" 2>/dev/null; then
    violations+=("추가: quartz/$rel")
  fi
done < <(git -C "$QUARTZ_ROOT" ls-files quartz/ | sed 's#^quartz/##')

if ((${#violations[@]} > 0)); then
  printf '%s\n' "${violations[@]}"
  exit 1
fi

exit 0
