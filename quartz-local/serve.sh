#!/usr/bin/env bash
# fos-brain 로컬 전체 그래프 빌드 (public + private + work). 비공개 포함 — 절대 게시 금지.
# 병합 content 는 repo 밖 temp 에 둔다 (repo 안에 두면 .gitignore 때문에 Quartz 가 입력을 걸러냄).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTENT="${TMPDIR:-/tmp}/fos-brain-local-content"
OUT="$ROOT/quartz-local/public"

rm -rf "$CONTENT" && mkdir -p "$CONTENT"
# 공개 config 의 ignorePatterns(private/work) 회피 위해 _ prefix 사용
ln -s "$ROOT/wiki"         "$CONTENT/public"
ln -s "$ROOT/private/wiki" "$CONTENT/_private"
ln -s "$ROOT/work/wiki"    "$CONTENT/_work"

cd "$ROOT/quartz"
pnpm quartz build -d "$CONTENT" -o "$OUT" --serve --port 8081
