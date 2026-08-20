#!/usr/bin/env bash
# fos-brain 로컬 전체 그래프 빌드 (public + private). 비공개 포함 — 절대 게시 금지.
# 병합 content 는 repo 밖 temp 에 둔다 (repo 안에 두면 .gitignore 때문에 Quartz 가 입력을 걸러냄).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTENT="${TMPDIR:-/tmp}/fos-brain-local-content"
OUT="$ROOT/quartz-local/public"

rm -rf "$CONTENT" && mkdir -p "$CONTENT"
# 공개 config 의 ignorePatterns(private) 회피 위해 _ prefix 사용
ln -s "$ROOT/wiki"         "$CONTENT/public"
[ -d "$ROOT/private/wiki" ] && ln -s "$ROOT/private/wiki" "$CONTENT/_private"

# raw 병합 — wiki 의 Sources 링크([[../../raw/...]])는 모든 네임스페이스에서
# content/raw 로 수렴하므로, public·private raw 를 content/raw 에 병합한다.
# 로컬 전용 빌드라 비공개 raw 포함 OK (게시 금지). 파일명은 날짜 prefix 로 대체로 고유.
mkdir -p "$CONTENT/raw"
cp -RL "$ROOT/raw/." "$CONTENT/raw/" 2>/dev/null || true
[ -d "$ROOT/private/raw" ] && cp -RL "$ROOT/private/raw/." "$CONTENT/raw/" 2>/dev/null || true

# 루트 대문 페이지 — / 가 404 가 되지 않도록 네임스페이스로 안내
{
  echo "# fos-brain (로컬 전체)"
  echo ""
  echo "공개 + 개인 비공개 자료를 포함한 로컬 전용 그래프입니다. 게시 금지."
  echo ""
  echo "## 네임스페이스"
  echo ""
  echo "- [[public/INDEX|공개 (public)]]"
  [ -d "$CONTENT/_private" ] && echo "- [[_private/INDEX|개인 비공개 (private)]]"
} > "$CONTENT/index.md"

cd "$ROOT/quartz"
pnpm quartz build -d "$CONTENT" -o "$OUT" --serve --port 8081
