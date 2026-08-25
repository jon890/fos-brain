#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "사용법: show_preview.sh <preview.html>" >&2
  exit 2
fi

preview_path=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
if [[ ! -f "$preview_path" ]]; then
  echo "미리보기 파일을 찾을 수 없습니다: $preview_path" >&2
  exit 1
fi

delegates=(
  "${CONTENT_PREVIEW_SHOW:-}"
  "$HOME/.claude/skills/content-preview/scripts/show-preview.sh"
  "$HOME/.codex/skills/content-preview/scripts/show-preview.sh"
)

for delegate in "${delegates[@]}"; do
  if [[ -n "$delegate" && -x "$delegate" && "$delegate" != "$0" ]]; then
    exec "$delegate" "$preview_path"
  fi
done

if command -v open >/dev/null 2>&1; then
  exec open "$preview_path"
fi
if command -v xdg-open >/dev/null 2>&1; then
  exec xdg-open "$preview_path"
fi

echo "content-preview helper 또는 시스템 브라우저 열기 명령을 찾을 수 없습니다." >&2
exit 1
