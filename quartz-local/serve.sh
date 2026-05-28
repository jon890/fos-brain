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
[ -d "$ROOT/private/wiki" ] && ln -s "$ROOT/private/wiki" "$CONTENT/_private"
# work 는 회사별 서브레벨(work/<회사>/wiki) — 각 회사를 _work_<회사> 로 병합
companies=()
for cw in "$ROOT"/work/*/wiki; do
  [ -d "$cw" ] || continue
  company="$(basename "$(dirname "$cw")")"
  ln -s "$cw" "$CONTENT/_work_${company}"
  companies+=("$company")
done

# 루트 대문 페이지 — / 가 404 가 되지 않도록 네임스페이스로 안내
{
  echo "# fos-brain (로컬 전체)"
  echo ""
  echo "공개 + 개인 비공개 + 회사 자료를 모두 포함한 로컬 전용 그래프입니다. 게시 금지."
  echo ""
  echo "## 네임스페이스"
  echo ""
  echo "- [[public/INDEX|공개 (public)]]"
  [ -d "$CONTENT/_private" ] && echo "- [[_private/INDEX|개인 비공개 (private)]]"
  for company in "${companies[@]}"; do
    echo "- [[_work_${company}/INDEX|회사: ${company}]]"
  done
} > "$CONTENT/index.md"

cd "$ROOT/quartz"
pnpm quartz build -d "$CONTENT" -o "$OUT" --serve --port 8081
