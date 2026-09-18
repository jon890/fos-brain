#!/usr/bin/env bash
# `scripts/verify-public-infra-boundary.sh` 의 회귀 검사다.
#
# **이 파일에도 감출 값을 적지 않는다.**
# 검사가 무엇을 잡는지 보이려고 실제 값을 fixture 로 쓰면 그 값이 공개된다.
# 대신 아래를 쓴다.
#
#   형태 패턴   문서용·시험용으로 예약된 값과 지어낸 이름으로 만든다
#   값 목록     지어낸 정규식을 담은 임시 목록 파일을 만들어 `PUBLIC_REPO_DENYLIST` 로 준다
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

# 검사가 git 이 추적하는 파일만 보므로 fixture 도 git 저장소로 만든다.
git -C "$fixture_root" init --quiet
git -C "$fixture_root" config user.email fixture@example.com
git -C "$fixture_root" config user.name fixture

# 값 목록이 없는 상태를 기본으로 둔다. 있으면 그 목록이 fixture 를 잡아 결과가 흔들린다.
empty_denylist="$fixture_root/denylist-empty.txt"
: > "$empty_denylist"
export PUBLIC_REPO_DENYLIST="$empty_denylist"

run_boundary() {
  git -C "$fixture_root" add -A
  bash "$fixture_root/scripts/verify-public-infra-boundary.sh" "$@"
}

fail() {
  echo "$1" >&2
  exit 1
}

# 제품·도구 이름만 있으면 통과한다.
printf '%s\n' 'Cloudflare Access' 'Cloudflare Tunnel' 'cloudflared' > "$fixture_root/docs/products.md"
run_boundary >/dev/null || fail "boundary verification rejected product names alone"

# 형태 패턴이 잡아야 하는 것.
# 지어낸 이름과 문서·시험용으로 예약된 주소만 쓴다.
shaped_leaks=(
  '배포 경로는 /home/exampleuser/apps/example 아래에 둔다'
  'docker exec example-container ls /'
  'docker network create example-net'
  'EXAMPLE_API_KEY=abcdefghijklmnopqrstuvwxyz012345'
  'ssh examplehost docker ps'
  '접속 주소는 198.18.0.1 이다'
)

for leak in "${shaped_leaks[@]}"; do
  printf '%s\n' "$leak" > "$fixture_root/docs/leak.md"
  if run_boundary >/dev/null 2>&1; then
    fail "boundary verification accepted an operational shape: $leak"
  fi
done
rm -f "$fixture_root/docs/leak.md"

# 사설 대역과 문서용 대역은 우리 환경을 가리키지 않으므로 통과해야 한다.
printf '%s\n' '127.0.0.1' '10.0.0.1' '192.168.0.1' '172.16.0.1' '203.0.113.5' \
  > "$fixture_root/docs/harmless-addresses.md"
run_boundary >/dev/null || fail "boundary verification rejected non-routable addresses"
rm -f "$fixture_root/docs/harmless-addresses.md"

# 값 목록 층이 동작하는지 본다. 지어낸 정규식을 임시 목록에 담아 준다.
loaded_denylist="$fixture_root/denylist-loaded.txt"
printf '%s\n' '# 지어낸 값' 'example-private-identifier' > "$loaded_denylist"
printf '%s\n' 'example-private-identifier' > "$fixture_root/docs/leak.md"
PUBLIC_REPO_DENYLIST="$loaded_denylist" run_boundary >/dev/null 2>&1 \
  && fail "boundary verification ignored the private denylist"
run_boundary >/dev/null \
  || fail "boundary verification failed with an empty denylist"
rm -f "$fixture_root/docs/leak.md"

# 값 목록의 허용 층이 동작하는지 본다.
# 지어낸 도메인 하나를 금지하고 그 아래 이름 하나만 허용한다.
allow_denylist="$fixture_root/denylist-allow.txt"
printf '%s\n' \
  '# 지어낸 값' \
  '(^|[^[:alnum:]_.-])[a-z0-9-]+\.example-private\.test([^[:alnum:]_.-]|$)' \
  '!(^|[^[:alnum:]_.-])allowed\.example-private\.test([^[:alnum:]_.-]|$)' \
  > "$allow_denylist"

# 허용 패턴에 맞는 줄은 걸리지 않는다.
printf '%s\n' '공개해 둔 주소는 allowed.example-private.test 이다' > "$fixture_root/docs/leak.md"
PUBLIC_REPO_DENYLIST="$allow_denylist" run_boundary >/dev/null \
  || fail "boundary verification rejected an allowed line"

# 같은 규칙에 걸리는 다른 줄은 그대로 걸린다.
printf '%s\n' '내부 주소는 blocked.example-private.test 이다' > "$fixture_root/docs/leak.md"
PUBLIC_REPO_DENYLIST="$allow_denylist" run_boundary >/dev/null 2>&1 \
  && fail "an allow pattern disabled the whole denylist rule"

# 허용된 줄과 걸리는 줄이 함께 있으면 걸리는 줄만 남아 잡힌다.
printf '%s\n' \
  '공개해 둔 주소는 allowed.example-private.test 이다' \
  '내부 주소는 blocked.example-private.test 이다' > "$fixture_root/docs/leak.md"
PUBLIC_REPO_DENYLIST="$allow_denylist" run_boundary >/dev/null 2>&1 \
  && fail "an allowed line masked a blocked line in the same rule"
rm -f "$fixture_root/docs/leak.md"

# 값 목록을 읽지 못해도 검사 자체는 돌아야 한다.
PUBLIC_REPO_DENYLIST="$fixture_root/does-not-exist.txt" run_boundary >/dev/null \
  || fail "boundary verification failed when the denylist was unavailable"

# 비공개 저장소가 갖는 디렉터리와 문서가 되돌아오면 잡는다.
mkdir -p "$fixture_root/deploy"
: > "$fixture_root/deploy/keep.txt"
run_boundary >/dev/null 2>&1 && fail "boundary verification accepted a tracked deploy/ directory"
rm -rf "$fixture_root/deploy"

mkdir -p "$fixture_root/tasks"
cp -R "$fixture_root/docs" "$fixture_root/tasks/plan6-hermes-qmd-search"
run_boundary >/dev/null 2>&1 && fail "boundary verification accepted an infra-only path"
rm -rf "$fixture_root/tasks/plan6-hermes-qmd-search"

# 공개 Quartz 산출물에 비공개 fixture 가 섞이면 잡는다.
private_fixture_values=(
  'private-auth-fixture'
  'Private Auth Fixture'
  'protected fixture'
  'private-secret-rag'
  'Private Shadow Node'
)

for value in "${private_fixture_values[@]}"; do
  printf '%s\n' "$value" > "$fixture_root/quartz/public/index.html"
  if run_boundary >/dev/null 2>&1; then
    fail "boundary verification accepted private fixture data in public artifacts"
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

rg -q 'Public Auth Fixture' "$fixture_root/quartz/public/index.html" \
  || fail "Quartz build did not render the public fixture"

public_artifacts=(
  "$fixture_root/quartz/public/index.html"
  "$fixture_root/quartz/public/static/contentIndex.json"
  "$fixture_root/quartz/public/static/memory-atlas-index.json"
  "$fixture_root/quartz/public/static/memory-atlas-semantics.json"
  "$fixture_root/quartz/public/sitemap.xml"
  "$fixture_root/quartz/public/index.xml"
)
for artifact in "${public_artifacts[@]}"; do
  [[ -f "$artifact" ]] || fail "Quartz build did not create expected public artifact: $artifact"
done
run_boundary >/dev/null || fail "boundary verification rejected a clean Quartz build"

for artifact in "${public_artifacts[@]}"; do
  clean_artifact="$artifact.clean"
  cp "$artifact" "$clean_artifact"
  printf '%s\n' 'private-auth-fixture' >> "$artifact"
  if run_boundary >/dev/null 2>&1; then
    fail "boundary verification did not scan Quartz artifact: $artifact"
  fi
  mv "$clean_artifact" "$artifact"
done

echo "Public infrastructure boundary regression passed."
