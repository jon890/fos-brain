#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d)"
trap 'rm -rf "$fixture_root"' EXIT

mkdir -p \
  "$fixture_root/scripts" \
  "$fixture_root/docs" \
  "$fixture_root/content/concepts" \
  "$fixture_root/content/private/concepts" \
  "$fixture_root/quartz/public/static"
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

rm -f "$fixture_root/docs/leak.txt"
private_fixture_values=(
  'private-auth-fixture'
  'Private Auth Fixture'
  'protected fixture'
  'private-secret-rag'
  'Private Shadow Node'
)

for value in "${private_fixture_values[@]}"; do
  printf '%s\n' "$value" > "$fixture_root/quartz/public/index.html"
  if bash "$fixture_root/scripts/verify-public-infra-boundary.sh" >/dev/null 2>&1; then
    echo "boundary verification accepted private fixture data in public artifacts" >&2
    exit 1
  fi
done

rm -rf "$fixture_root/quartz/public"
printf '%s\n' \
  '---' \
  'title: Public Auth Fixture' \
  'description: public fixture body' \
  '---' \
  '# Public Auth Fixture' \
  'public fixture body' > "$fixture_root/content/index.md"
printf '%s\n' \
  '---' \
  'title: Private Auth Fixture' \
  'description: protected fixture' \
  'tags: [private-secret-rag]' \
  '---' \
  '# Private Auth Fixture' \
  'Private Shadow Node' > "$fixture_root/content/private/concepts/private-auth-fixture.md"

(
  cd "$repo_root/quartz"
  pnpm quartz build --directory "$fixture_root/content" --output "$fixture_root/quartz/public" >/dev/null
)

rg -q 'Public Auth Fixture' "$fixture_root/quartz/public/index.html" || {
  echo "Quartz build did not render the public fixture" >&2
  exit 1
}
public_artifacts=(
  "$fixture_root/quartz/public/index.html"
  "$fixture_root/quartz/public/static/contentIndex.json"
  "$fixture_root/quartz/public/static/memory-atlas-semantics.json"
  "$fixture_root/quartz/public/sitemap.xml"
  "$fixture_root/quartz/public/index.xml"
)
for artifact in "${public_artifacts[@]}"; do
  [[ -f "$artifact" ]] || {
    echo "Quartz build did not create expected public artifact: $artifact" >&2
    exit 1
  }
done
bash "$fixture_root/scripts/verify-public-infra-boundary.sh" >/dev/null

for artifact in "${public_artifacts[@]}"; do
  clean_artifact="$artifact.clean"
  cp "$artifact" "$clean_artifact"
  printf '%s\n' 'private-auth-fixture' >> "$artifact"
  if bash "$fixture_root/scripts/verify-public-infra-boundary.sh" >/dev/null 2>&1; then
    echo "boundary verification did not scan Quartz artifact: $artifact" >&2
    exit 1
  fi
  mv "$clean_artifact" "$artifact"
done

echo "Public infrastructure boundary regression passed."
