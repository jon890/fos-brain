#!/usr/bin/env bash
# 자동 트리거 — wiki 문서 저장(Write/Edit) 직후 brain-readability 자동 검사.
# PostToolUse(Write|Edit) hook 으로 등록한다. 페이지 저장 순간 가독성 위반(인라인 연결·
# 표현 사전·명사형 종결 등)을 노출해, 사람이 매번 지적하지 않아도 작성 즉시 드러나게 한다.
set -euo pipefail

ROOT=/Users/nhn/personal/fos-brain
CHECKER="$ROOT/scripts/brain-readability.py"

# hook 입력(JSON) 에서 file_path 추출
input=$(cat)
fp=$(printf '%s' "$input" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))
except Exception: print("")' 2>/dev/null || true)

# wiki/ 안 .md 만 대상 (public·work·private). INDEX·log 는 checker 가 자동 skip.
case "$fp" in
  "$ROOT"/wiki/*.md|"$ROOT"/work/*/wiki/*.md|"$ROOT"/private/wiki/*.md) ;;
  *) exit 0 ;;
esac
[ -f "$fp" ] || exit 0

# 위반이 있으면 checker 가 리포트를 출력하고 exit 1 → hook 은 비차단(|| true)으로 노출만 한다.
python3 "$CHECKER" "$fp" 2>/dev/null || true
exit 0
