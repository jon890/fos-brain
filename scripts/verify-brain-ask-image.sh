#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
image_ref="${1:-fos-brain/brain-ask:phase04-test}"
target_platform="linux/amd64"
fixture_root="$(mktemp -d "$repo_root/.brain-ask-image.XXXXXX")"
running_container=""
missing_config_container=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if [[ -n "$running_container" ]]; then
    docker rm -f "$running_container" >/dev/null 2>&1 || true
  fi
  if [[ -n "$missing_config_container" ]]; then
    docker rm -f "$missing_config_container" >/dev/null 2>&1 || true
  fi
  rm -rf "$fixture_root"
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

fail() {
  echo "brain-ask image verification failed: $*" >&2
  exit 1
}

mkdir -p "$fixture_root/public/wiki" "$fixture_root/private/wiki"
printf '%s\n' 'fixture-model-key' > "$fixture_root/model-key"
node -e 'const { randomBytes, scryptSync } = require("node:crypto"); const salt = randomBytes(16); const key = scryptSync("fixture-password", salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }); process.stdout.write(`scrypt$131072$8$1$${salt.toString("base64url")}$${key.toString("base64url")}\n`)' > "$fixture_root/password-hash"
printf '%s\n' '{"nodes":[]}' > "$fixture_root/content-index.json"
printf '%s\n' '{"schemaVersion":1,"edges":[]}' > "$fixture_root/memory-atlas-semantics.json"
chmod 600 "$fixture_root/model-key" "$fixture_root/password-hash"

docker build --platform "$target_platform" -t "$image_ref" -f "$repo_root/services/brain-ask/Dockerfile" "$repo_root"

image_architecture="$(docker image inspect -f '{{.Architecture}}' "$image_ref")"
[[ "$image_architecture" == "amd64" ]] || fail "image architecture is $image_architecture instead of amd64"

image_uid="$(docker run --rm --platform "$target_platform" --entrypoint id "$image_ref" -u)"
[[ "$image_uid" == "1000" ]] || fail "runtime UID is $image_uid instead of 1000"

for variable in \
  MODEL_API_KEY_FILE \
  BRAIN_ADMIN_PASSWORD_HASH_FILE \
  BRAIN_PUBLIC_WIKI_ROOT \
  BRAIN_PRIVATE_WIKI_ROOT \
  BRAIN_PRIVATE_CONTENT_INDEX_FILE \
  BRAIN_PRIVATE_MEMORY_ATLAS_SEMANTICS_FILE \
  BRAIN_TRUST_PROXY_HOPS
do
  rg -q "$variable" "$repo_root/services/brain-ask/src/config/environment.ts" || fail "$variable is missing from runtime configuration"
  rg -q "$variable" "$repo_root/docs/data-schema.md" || fail "$variable is missing from the documented mount contract"
done

image_metadata="$(docker image inspect "$image_ref"; docker history --no-trunc "$image_ref")"
if rg -q \
  -e 'fixture-model-key' \
  -e 'fixture-password' <<< "$image_metadata"; then
  fail "image metadata contains a fixture secret"
fi

missing_config_container="$(docker run -d --platform "$target_platform" "$image_ref")"
missing_exit="$(docker wait "$missing_config_container")"
[[ "$missing_exit" != "0" ]] || fail "image started without required configuration"
missing_logs="$(docker logs "$missing_config_container" 2>&1 || true)"
if [[ "$missing_logs" == *"fixture-model-key"* || "$missing_logs" == *"fixture-password"* ]]; then
  fail "missing-configuration logs exposed fixture secrets"
fi
docker rm "$missing_config_container" >/dev/null
missing_config_container=""

running_container="$(docker run -d --platform "$target_platform" -p 127.0.0.1::8787 \
  --health-interval=1s \
  --health-start-period=1s \
  --health-timeout=3s \
  --health-retries=10 \
  -e NODE_ENV=production \
  -e BRAIN_QMD_URL=http://127.0.0.1:8181 \
  -e MODEL_API_BASE_URL=http://127.0.0.1:8182 \
  -e MODEL_API_KEY_FILE=/run/secrets/model-key \
  -e BRAIN_PUBLIC_WIKI_ROOT=/brain/public/wiki \
  -e BRAIN_PRIVATE_WIKI_ROOT=/brain/private/wiki \
  -e BRAIN_ADMIN_PASSWORD_HASH_FILE=/run/secrets/password-hash \
  -e BRAIN_PRIVATE_CONTENT_INDEX_FILE=/brain/private/content-index.json \
  -e BRAIN_PRIVATE_MEMORY_ATLAS_SEMANTICS_FILE=/brain/private/memory-atlas-semantics.json \
  -e BRAIN_ORIGIN=http://127.0.0.1:8787 \
  -e BRAIN_TRUST_PROXY_HOPS=0 \
  --mount "type=bind,src=$fixture_root/model-key,dst=/run/secrets/model-key,readonly" \
  --mount "type=bind,src=$fixture_root/password-hash,dst=/run/secrets/password-hash,readonly" \
  --mount "type=bind,src=$fixture_root/public/wiki,dst=/brain/public/wiki,readonly" \
  --mount "type=bind,src=$fixture_root/private/wiki,dst=/brain/private/wiki,readonly" \
  --mount "type=bind,src=$fixture_root/content-index.json,dst=/brain/private/content-index.json,readonly" \
  --mount "type=bind,src=$fixture_root/memory-atlas-semantics.json,dst=/brain/private/memory-atlas-semantics.json,readonly" \
  "$image_ref")"

host_port="$(docker port "$running_container" 8787/tcp | sed -n 's/.*:\([0-9][0-9]*\)$/\1/p' | head -1)"
[[ -n "$host_port" ]] || fail "Docker did not publish port 8787"
for _ in {1..100}; do
  if curl -fsS "http://127.0.0.1:$host_port/api/health" 2>/dev/null | rg -q '"ok":true'; then
    break
  fi
  if [[ "$(docker inspect -f '{{.State.Running}}' "$running_container")" != "true" ]]; then
    fail "configured container exited before health became ready"
  fi
  sleep 0.1
done
curl -fsS "http://127.0.0.1:$host_port/api/health" | rg -q '"ok":true' || fail "health endpoint did not become ready"
[[ "$(docker exec "$running_container" id -u)" == "1000" ]] || fail "running container is not UID 1000"

for _ in {1..100}; do
  health_status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$running_container")"
  [[ "$health_status" == "healthy" ]] && break
  [[ "$health_status" != "unhealthy" ]] || fail "Docker HEALTHCHECK became unhealthy"
  sleep 0.1
done
[[ "$health_status" == "healthy" ]] || fail "Docker HEALTHCHECK did not become healthy: $health_status"

docker stop --time 10 "$running_container" >/dev/null
exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$running_container")"
oom_killed="$(docker inspect -f '{{.State.OOMKilled}}' "$running_container")"
[[ "$oom_killed" == "false" ]] || fail "container was OOM-killed"
[[ "$exit_code" != "137" ]] || fail "container required SIGKILL during shutdown"
docker rm "$running_container" >/dev/null
running_container=""

echo "brain-ask image verification passed: platform=$target_platform, uid=1000, endpoint=200, docker-health=$health_status, missing-config=$missing_exit, shutdown=$exit_code"
