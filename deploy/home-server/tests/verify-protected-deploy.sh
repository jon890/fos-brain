#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$TEST_DIR/.." && pwd)"
TEST_ROOT="$TEST_DIR/.tmp-protected-deploy.$$"
PUBLIC_REPO="$TEST_ROOT/public"
PRIVATE_REPO="$TEST_ROOT/private"
OUTPUT_ROOT="$TEST_ROOT/output"
RENDERER="$TEST_ROOT/render-fixture.sh"
NODE_IMAGE="$(sed -n 's/^NODE_IMAGE="\([^"]*\)"/\1/p' "$DEPLOY_DIR/build-protected.sh")"
NGINX_IMAGE="$(sed -n 's/^NGINX_IMAGE=//p' "$DEPLOY_DIR/.env.example")"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap 'status=$?; cleanup || status=1; exit "$status"' EXIT

mkdir -p \
  "$PUBLIC_REPO/quartz" \
  "$PUBLIC_REPO/wiki/concepts" \
  "$PUBLIC_REPO/wiki/topics" \
  "$PUBLIC_REPO/wiki/entities" \
  "$PUBLIC_REPO/raw" \
  "$PRIVATE_REPO/wiki/concepts" \
  "$PRIVATE_REPO/raw"

: > "$PUBLIC_REPO/quartz/pnpm-lock.yaml"
printf '# Public\n' > "$PUBLIC_REPO/wiki/INDEX.md"
printf '# Concept\n' > "$PUBLIC_REPO/wiki/concepts/public-concept.md"
printf '# Topic\n' > "$PUBLIC_REPO/wiki/topics/public-topic.md"
printf '# Entity\n' > "$PUBLIC_REPO/wiki/entities/public-entity.md"
printf 'PUBLIC_RAW_SENTINEL\n' > "$PUBLIC_REPO/raw/source.txt"
printf '# Private\n' > "$PRIVATE_REPO/wiki/INDEX.md"
printf '# Secret\n' > "$PRIVATE_REPO/wiki/concepts/private-concept.md"
printf 'PRIVATE_RAW_SENTINEL\n' > "$PRIVATE_REPO/raw/secret.txt"
printf 'gitdir: /nonexistent-public-git-dir\n' > "$PUBLIC_REPO/.git"
printf 'gitdir: /nonexistent-private-git-dir\n' > "$PRIVATE_REPO/.git"

cat > "$RENDERER" <<'RENDERER_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
content_dir="$1"
output_dir="$2"

[[ -f "$content_dir/INDEX.md" ]]
[[ -f "$content_dir/_private/INDEX.md" ]]
[[ ! -e "$content_dir/raw" ]]
[[ ! -e "$content_dir/work" ]]

if [[ "${PROTECTED_TEST_RENDER_FAIL:-0}" == "1" ]]; then
  exit 42
fi

if [[ -n "${PROTECTED_TEST_ACTIVE_DIR:-}" ]]; then
  if ! mkdir "$PROTECTED_TEST_ACTIVE_DIR" 2>/dev/null; then
    printf 'collision\n' >> "${PROTECTED_TEST_COLLISIONS:?}"
  fi
  printf 'run\n' >> "${PROTECTED_TEST_RUNS:?}"
  sleep 1
fi

mkdir -p "$output_dir/concepts" "$output_dir/topics" "$output_dir/entities" \
  "$output_dir/_private/concepts" "$output_dir/static"
printf '<html>public</html>\n' > "$output_dir/INDEX.html"
printf '<html>404</html>\n' > "$output_dir/404.html"
printf '<html>concept</html>\n' > "$output_dir/concepts/public-concept.html"
printf '<html>topic</html>\n' > "$output_dir/topics/public-topic.html"
printf '<html>entity</html>\n' > "$output_dir/entities/public-entity.html"
printf '<html>private</html>\n' > "$output_dir/_private/INDEX.html"
printf '<html>secret</html>\n' > "$output_dir/_private/concepts/private-concept.html"
printf '{}\n' > "$output_dir/static/contentIndex.json"

if [[ "${PROTECTED_TEST_FORBIDDEN_OUTPUT:-0}" == "1" ]]; then
  mkdir -p "$output_dir/raw"
fi

if [[ -n "${PROTECTED_TEST_ACTIVE_DIR:-}" ]]; then
  rmdir "$PROTECTED_TEST_ACTIVE_DIR"
fi
RENDERER_SCRIPT
chmod +x "$RENDERER"

run_build() {
  BRAIN_REPO="$PUBLIC_REPO" \
  PRIVATE_BRAIN_REPO="$PRIVATE_REPO" \
  PROTECTED_OUTPUT_ROOT="$OUTPUT_ROOT" \
  PROTECTED_BUILD_RENDERER="$RENDERER" \
  PROTECTED_RELEASE_ID="$1" \
    "$DEPLOY_DIR/build-protected.sh"
}

run_build release-1
[[ "$(readlink "$OUTPUT_ROOT/current")" == "releases/release-1" ]]
[[ -s "$OUTPUT_ROOT/current/index.html" ]]
[[ -s "$OUTPUT_ROOT/current/_private/index.html" ]]
[[ ! -e "$OUTPUT_ROOT/current/raw" && ! -e "$OUTPUT_ROOT/current/work" ]]
if grep -R -I -F -e PUBLIC_RAW_SENTINEL -e PRIVATE_RAW_SENTINEL "$OUTPUT_ROOT/current"; then
  echo "A raw sentinel leaked into the protected release." >&2
  exit 1
fi

if PROTECTED_TEST_FORBIDDEN_OUTPUT=1 run_build release-forbidden; then
  echo "A forbidden output path was accepted." >&2
  exit 1
fi
[[ "$(readlink "$OUTPUT_ROOT/current")" == "releases/release-1" ]]

if PROTECTED_TEST_RENDER_FAIL=1 run_build release-failed; then
  echo "A failed renderer was accepted." >&2
  exit 1
fi
[[ "$(readlink "$OUTPUT_ROOT/current")" == "releases/release-1" ]]

if BRAIN_REPO="$PUBLIC_REPO" \
  PRIVATE_BRAIN_REPO="$PRIVATE_REPO" \
  PROTECTED_OUTPUT_ROOT="$OUTPUT_ROOT" \
  PROTECTED_BUILD_RENDERER="$RENDERER" \
    "$DEPLOY_DIR/build-protected.sh"; then
  echo "A default release id was accepted without readable git HEADs." >&2
  exit 1
fi
[[ "$(readlink "$OUTPUT_ROOT/current")" == "releases/release-1" ]]

mkdir -p "$TEST_ROOT/lock-public/.git" "$TEST_ROOT/lock-private/.git" "$TEST_ROOT/bin"
cp -a "$PUBLIC_REPO/quartz" "$PUBLIC_REPO/wiki" "$TEST_ROOT/lock-public/"
cp -a "$PRIVATE_REPO/wiki" "$TEST_ROOT/lock-private/"
cat > "$TEST_ROOT/bin/git" <<'FAKE_GIT'
#!/usr/bin/env bash
set -euo pipefail
while [[ "$1" == "-C" ]]; do
  shift 2
done
case "$1" in
  status) exit 0 ;;
  symbolic-ref) printf '%s\n' "${FAKE_GIT_BRANCH:-main}" ;;
  fetch|merge) exit 0 ;;
  rev-parse) printf '012345678901\n' ;;
  merge-base) exit 0 ;;
  *) echo "Unexpected fake git command: $*" >&2; exit 64 ;;
esac
FAKE_GIT
chmod +x "$TEST_ROOT/bin/git"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$TEST_ROOT,dst=/test" \
  --mount "type=bind,src=$DEPLOY_DIR,dst=/deploy,readonly" \
  "$NODE_IMAGE" \
  sh -euc '
    export PATH="/test/bin:$PATH"
    export BRAIN_DEPLOY_ROOT=/deploy
    export BRAIN_REPO=/test/lock-public
    export PRIVATE_BRAIN_REPO=/test/lock-private
    export PROTECTED_OUTPUT_ROOT=/test/lock-output
    export BRAIN_SYNC_LOCK=/test/sync.lock
    export PROTECTED_BUILD_RENDERER=/test/render-fixture.sh
    export PROTECTED_TEST_ACTIVE_DIR=/test/render-active
    export PROTECTED_TEST_COLLISIONS=/test/collisions
    export PROTECTED_TEST_RUNS=/test/runs
    /deploy/sync-protected.sh &
    first=$!
    /deploy/sync-protected.sh &
    second=$!
    wait "$first"
    wait "$second"
    test "$(wc -l < /test/runs)" -eq 2
    test ! -s /test/collisions
    find /test/lock-output/releases -mindepth 1 -maxdepth 1 -type d -print \
      | sed "s#.*/##" \
      | grep -Eq "^[0-9a-f]{12}-[0-9a-f]{12}-[0-9]{8}T[0-9]{6}Z$"
    current_before="$(readlink /test/lock-output/current)"
    if FAKE_GIT_BRANCH=feature /deploy/sync-protected.sh; then
      echo "A non-main checkout was accepted." >&2
      exit 1
    fi
    test "$(readlink /test/lock-output/current)" = "$current_before"
  '

COMPOSE_CONFIG="$TEST_ROOT/compose-config.yaml"
docker compose \
  --env-file "$DEPLOY_DIR/.env.example" \
  --file "$DEPLOY_DIR/compose.yaml" \
  config > "$COMPOSE_CONFIG"

if grep -Eq '^[[:space:]]+ports:' "$COMPOSE_CONFIG"; then
  echo "Compose must not publish host ports." >&2
  exit 1
fi

grep -Fq 'source: /home/bifos/personal/fos-brain/quartz-protected' "$COMPOSE_CONFIG"
grep -Fq 'source: /home/bifos/apps/fos-brain-deploy/nginx.conf' "$COMPOSE_CONFIG"
grep -Fq 'target: /usr/share/nginx/html' "$COMPOSE_CONFIG"
grep -Fq 'read_only: true' "$COMPOSE_CONFIG"
grep -Fq 'root /usr/share/nginx/html/current;' "$DEPLOY_DIR/nginx.conf"
grep -Fq 'X-Robots-Tag "noindex, nofollow, noarchive" always;' "$DEPLOY_DIR/nginx.conf"
grep -Fq 'Cache-Control "private, no-store" always;' "$DEPLOY_DIR/nginx.conf"

docker run --rm \
  --mount "type=bind,src=$DEPLOY_DIR/nginx.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  "$NGINX_IMAGE" \
  nginx -t

echo "Protected deployment verification passed."
