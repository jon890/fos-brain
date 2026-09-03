#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

mkdir -p "$fixture_root/scripts" "$fixture_root/docs"
cp "$repo_root/scripts/verify-public-infra-boundary.sh" "$fixture_root/scripts/"
printf '%s\n' 'Cloudflare Access' 'Cloudflare Tunnel' 'cloudflared' > "$fixture_root/docs/products.md"
bash "$fixture_root/scripts/verify-public-infra-boundary.sh" >/dev/null

blocked_identifiers=(
  'deploy/''home-server'
  '/home/bi''fos'
  '61.''80.10.20'
  'fosworld.''co.kr'
  'public-''net'
  'brain-search-''net'
  'hermes-agent_hermes-''net'
  'quartz-''protected'
  'career-''api'
  'brain-qmd:''8181'
  'TUNNEL_''TOKEN'
  'Jenk''ins'
)

for identifier in "${blocked_identifiers[@]}"; do
  printf '%s\n' "$identifier" > "$fixture_root/docs/leak.txt"
  if bash "$fixture_root/scripts/verify-public-infra-boundary.sh" >/dev/null 2>&1; then
    echo "boundary verification accepted an operational identifier" >&2
    exit 1
  fi
done

echo "Public infrastructure boundary regression passed."
