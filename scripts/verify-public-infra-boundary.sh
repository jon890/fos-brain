#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

if [[ -e deploy ]]; then
  echo "public repository must not track deploy/." >&2
  exit 1
fi

missing=0
for path in \
  docs/adr/002-cloudflare-tunnel-access-boundary.md \
  docs/adr/003-protected-private-quartz-release.md \
  tasks/plan2-cloudflare-access-home-server \
  tasks/plan3-protected-private-brain \
  tasks/plan6-hermes-qmd-search \
  tasks/plan4-memory-constellation/phase-05.md
do
  if [[ -e "$path" ]]; then
    echo "public repository still contains infra-only path: $path" >&2
    missing=1
  fi
done
[[ "$missing" == "0" ]]

scan_targets=(
  .gitignore
  CLAUDE.md
  docs
  tasks
  services
  scripts
  .agents/plugin/fos-brain/scripts
  .agents/plugin/fos-brain/tests
)

for target in "${scan_targets[@]}"; do
  [[ -e "$target" ]] || continue
  if rg -n --hidden --glob '!docs/retrospectives/000[1-4]-*.md' --glob '!docs/retrospectives/0014-*.md' \
    --glob '!scripts/verify-public-infra-boundary.sh' \
    -e 'deploy/home-server' \
    -e '/home/bifos' \
    -e '61\.80\.' \
    -e 'fosworld\.co\.kr' \
    -e 'public-net|brain-search-net|hermes-agent_hermes-net' \
    -e 'quartz-protected' \
    -e 'career-api' \
    -e 'brain-qmd:8181' \
    -e 'Cloudflare Access|Cloudflare Tunnel|cloudflared|TUNNEL_TOKEN' \
    -e 'Jenkins|jenkins' \
    "$target"; then
    echo "public repository contains private infra identifiers." >&2
    exit 1
  fi
done

echo "Public infrastructure boundary verification passed."
