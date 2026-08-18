#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$TEST_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"
PUBLIC_DIR="$REPO_ROOT/quartz/public"
COMPOSE_CONFIG="$(mktemp)"
PRIVATE_SENTINEL="FOS_BRAIN_PRIVATE_SENTINEL_DO_NOT_PUBLISH"
NGINX_IMAGE="$(sed -n 's/^NGINX_IMAGE=//p' "$DEPLOY_DIR/.env.example")"
NODE_IMAGE="$(sed -n 's/^NODE_IMAGE="\([^"]*\)"/\1/p' "$DEPLOY_DIR/build-public.sh")"

cleanup() {
  rm -f "$COMPOSE_CONFIG"
}
trap cleanup EXIT

bash -n "$DEPLOY_DIR/build-public.sh"

if ! git -C "$REPO_ROOT" check-ignore --quiet deploy/home-server/.env; then
  echo "The deployment secret file must be ignored by git." >&2
  exit 1
fi

if git -C "$REPO_ROOT" check-ignore --quiet deploy/home-server/.env.example; then
  echo "The safe environment example must remain tracked." >&2
  exit 1
fi

docker compose \
  --env-file "$DEPLOY_DIR/.env.example" \
  --file "$DEPLOY_DIR/compose.yaml" \
  config > "$COMPOSE_CONFIG"

if grep -Eq '^[[:space:]]+ports:' "$COMPOSE_CONFIG"; then
  echo "Compose must not publish host ports." >&2
  exit 1
fi

if grep -Eq '(^|[/"({[:space:]])private(/|[}")[:space:]]|$)|quartz-local' \
  "$DEPLOY_DIR/build-public.sh" "$DEPLOY_DIR/compose.yaml"; then
  echo "Deployment configuration references a non-public path." >&2
  exit 1
fi

if [[ "$(grep -Ec 'image: .+@sha256:[0-9a-f]{64}$' "$COMPOSE_CONFIG")" -ne 2 ]]; then
  echo "Both runtime images must use immutable digests." >&2
  exit 1
fi

docker run --rm \
  --mount "type=bind,src=$DEPLOY_DIR/nginx.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  "$NGINX_IMAGE" \
  nginx -t

docker run --rm \
  --mount "type=bind,src=$DEPLOY_DIR/build-public.sh,dst=/tmp/build-public.sh,readonly" \
  "$NODE_IMAGE" \
  sh -euc '
    mkdir -p /tmp/public
    printf "%s\n" "synthetic home" > /tmp/public/INDEX.html
    BUILD_PUBLIC_NORMALIZE_ONLY=1 /bin/bash /tmp/build-public.sh /tmp/public
    test -s /tmp/public/index.html
  '

"$DEPLOY_DIR/build-public.sh"

if [[ -e "$REPO_ROOT/quartz/.pnpm-store" ]]; then
  echo "The container package cache must not be written into the repository." >&2
  exit 1
fi

if [[ ! -s "$PUBLIC_DIR/index.html" || ! -s "$PUBLIC_DIR/404.html" ]]; then
  echo "Quartz did not emit the expected public pages." >&2
  exit 1
fi

if grep -R -I -n -F "$PRIVATE_SENTINEL" "$PUBLIC_DIR"; then
  echo "Private sentinel leaked into the public artifact." >&2
  exit 1
fi

if grep -R -I -n -E "(href|src)=[\"'][^\"']*(^|/)private/" "$PUBLIC_DIR"; then
  echo "A private path leaked into a generated URL." >&2
  exit 1
fi

echo "Public deployment verification passed."
