#!/usr/bin/env bash
set -Eeuo pipefail

# 이 스크립트는 Quartz fork 경계(ADR-012)를 검사한다.
# quartz/quartz/ 와 quartz/ 루트의 업스트림 파일이 복사 시점 커밋과
# 여전히 같은지, 그리고 quartz/quartz/ 아래 새 파일이 생기지 않았는지 확인한다.
#
# 경로 표기 규칙(작업 항목 3 참고): 이 스크립트 안에서 업스트림 기준 경로 P 는
# 이 저장소의 <REPO_ROOT>/quartz/P 에 대응한다.

# 복사 시점 커밋. 로컬에 없으면 업스트림에서 이 커밋만 얕게 fetch 한다.
UPSTREAM_BASE="d25a6eabf96751ffca56f8a8139272def7a65041"
UPSTREAM_URL="https://github.com/jackyzha0/quartz.git"

REPO_ROOT="$(git rev-parse --show-toplevel)"
QUARTZ_ROOT="$REPO_ROOT/quartz"

# 새로 clone 한 환경에는 quartz-upstream remote 가 없다. remote 를 등록하는 대신
# URL 을 직접 주어 기준 커밋 하나만 받아 온다. git 설정을 바꾸지 않는다.
if ! git -C "$REPO_ROOT" cat-file -e "$UPSTREAM_BASE" 2>/dev/null; then
  echo "기준 커밋 $UPSTREAM_BASE 가 로컬에 없어 업스트림에서 받아 온다." >&2
  git -C "$REPO_ROOT" fetch --quiet --depth=1 "$UPSTREAM_URL" "$UPSTREAM_BASE" 2>/dev/null || true
fi

if ! git -C "$REPO_ROOT" cat-file -e "$UPSTREAM_BASE" 2>/dev/null; then
  echo "기준 커밋 $UPSTREAM_BASE 를 찾을 수 없다. 네트워크가 닿는 곳에서 아래를 실행한다:" >&2
  echo "  git fetch --depth=1 $UPSTREAM_URL $UPSTREAM_BASE" >&2
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

# 2) 복사 대상으로 삼은 업스트림 루트 파일과 비교한다.
#    목록을 여기 명시해, 파일이 사라진 것도 위반으로 잡는다.
#    업스트림 루트에 있으나 이 저장소가 복사하지 않은 파일(.gitignore)은 목록에서 뺀다.
ROOT_FILES=(
  ".gitattributes"
  ".node-version"
  ".npmrc"
  ".prettierignore"
  ".prettierrc"
  "CODE_OF_CONDUCT.md"
  "Dockerfile"
  "LICENSE.txt"
  "README.md"
  "globals.d.ts"
  "index.d.ts"
  "package-lock.json"
  "package.json"
  "quartz.config.ts"
  "quartz.layout.ts"
  "tsconfig.json"
)

for rel in "${ROOT_FILES[@]}"; do
  repo_path="$QUARTZ_ROOT/$rel"
  if [[ ! -f "$repo_path" ]]; then
    violations+=("삭제: $rel")
    continue
  fi
  is_exception "$rel" && continue
  if ! diff -q <(git -C "$REPO_ROOT" show "$UPSTREAM_BASE:$rel") "$repo_path" >/dev/null 2>&1; then
    violations+=("수정: $rel")
  fi
done

# 3) 이 저장소가 quartz/quartz/ 아래 새로 만든 파일을 잡는다.
#    아직 commit 하지 않은 파일도 경계를 무너뜨리므로 --others 로 함께 본다.
while IFS= read -r rel; do
  if ! git -C "$REPO_ROOT" cat-file -e "$UPSTREAM_BASE:quartz/$rel" 2>/dev/null; then
    violations+=("추가: quartz/$rel")
  fi
done < <(
  git -C "$QUARTZ_ROOT" ls-files --cached --others --exclude-standard quartz/ |
    sed 's#^quartz/##' | sort -u
)

if ((${#violations[@]} > 0)); then
  printf '%s\n' "${violations[@]}"
  exit 1
fi

exit 0
