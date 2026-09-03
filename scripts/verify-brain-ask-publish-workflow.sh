#!/usr/bin/env bash
# shellcheck disable=SC2016
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workflow="$repo_root/.github/workflows/publish-brain-ask-image.yml"

fail() {
  echo "Brain Ask publish workflow verification failed: $*" >&2
  exit 1
}

[[ -f "$workflow" ]] || fail "workflow is missing"

required_lines=(
  "    if: github.repository == 'jon890/fos-brain'"
  '      contents: read'
  '      packages: write'
  '      IMAGE: ghcr.io/jon890/brain-ask'
  '          file: ./services/brain-ask/Dockerfile'
  '          platforms: linux/amd64'
  '          push: true'
  "          github-token: ''"
  '          tags: ghcr.io/jon890/brain-ask:sha-${{ github.sha }}'
  '          DIGEST: ${{ steps.push.outputs.digest }}'
  '          docker buildx imagetools inspect "$IMAGE@$DIGEST"'
  '            org.opencontainers.image.source=https://github.com/${{ github.repository }}'
  '            org.opencontainers.image.revision=${{ github.sha }}'
  '            echo "- image@digest: \`$IMAGE@$DIGEST\`"'
  '            echo "- source commit: \`$GITHUB_SHA\`"'
  '            echo "- workflow URL: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"'
)

for line in "${required_lines[@]}"; do
  rg -Fxq "$line" "$workflow" || fail "required contract is missing: $line"
done

rg -Fxq 'permissions: {}' "$workflow" || fail "workflow-level permissions must default to none"
job_names="$(sed -n '/^jobs:$/,$p' "$workflow" | sed -nE 's/^  ([a-zA-Z0-9_-]+):$/\1/p')"
[[ "$job_names" == 'publish' ]] || fail "workflow must contain only the publish job"

expected_actions=(
  'docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v4.3.0'
  'docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v4.6.0'
  'docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0'
)

actual_actions=()
while IFS= read -r action; do
  actual_actions+=("$action")
done < <(sed -nE 's/^[[:space:]]*uses:[[:space:]]+([^[:space:]]+.*)$/\1/p' "$workflow")
[[ ${#actual_actions[@]} -eq ${#expected_actions[@]} ]] || fail "workflow must use exactly the three approved actions"
for index in "${!expected_actions[@]}"; do
  [[ "${actual_actions[$index]}" == "${expected_actions[$index]}" ]] \
    || fail "action is not pinned to the approved full SHA: ${actual_actions[$index]}"
done
uses_key_count="$(rg -o "(^|[^[:alnum:]_-])uses[\"']?[[:space:]]*:" "$workflow" | wc -l | tr -d '[:space:]')"
[[ "$uses_key_count" == "${#expected_actions[@]}" ]] \
  || fail "workflow contains a non-canonical or additional uses entry"

event_names="$(sed -n '/^on:$/,/^permissions:/p' "$workflow" | sed -nE 's/^  ([a-z_]+):$/\1/p')"
[[ "$event_names" == "push" ]] || fail "publish trigger must contain only push"
if sed -n '/^on:$/,/^permissions:/p' "$workflow" \
  | rg -n "^    [\"']?tags(-ignore)?[\"']?[[:space:]]*:"; then
  fail "push tag filters are forbidden"
fi
rg -q '^    branches:$' "$workflow" || fail "main branch filter is missing"
branches=()
while IFS= read -r branch; do
  branches+=("$branch")
done < <(sed -n '/^    branches:$/,/^    paths:$/p' "$workflow" | sed -nE 's/^      - (.+)$/\1/p')
[[ ${#branches[@]} -eq 1 && "${branches[0]}" == 'main' ]] \
  || fail "publish branch must contain only main"
rg -q '^    paths:$' "$workflow" || fail "path filter is missing"
paths=()
while IFS= read -r path; do
  paths+=("$path")
done < <(sed -n '/^    paths:$/,/^[^ ]/p' "$workflow" | sed -nE 's/^      - (.+)$/\1/p')
[[ ${#paths[@]} -eq 1 && "${paths[0]}" == 'services/brain-ask/**' ]] \
  || fail "publish path must contain only services/brain-ask/**"

permission_lines=()
while IFS= read -r permission; do
  permission_lines+=("$permission")
done < <(sed -n '/^    permissions:$/,/^    env:$/p' "$workflow" | sed -nE 's/^      ([a-z-]+): (.+)$/\1:\2/p')
[[ ${#permission_lines[@]} -eq 2 ]] || fail "job permissions must contain exactly two entries"
[[ "${permission_lines[0]}" == 'contents:read' ]] || fail "contents permission must be read"
[[ "${permission_lines[1]}" == 'packages:write' ]] || fail "packages permission must be write"

for forbidden_yaml_key in \
  'pull_request' \
  'pull_request_target' \
  'workflow_run' \
  'id-token' \
  'context' \
  'build-contexts' \
  'build-args' \
  'secret-envs' \
  'secret-files' \
  'secrets' \
  'ssh' \
  'load' \
  'cache-from' \
  'cache-to'; do
  if rg -n "^[[:space:]]*['\"]?${forbidden_yaml_key}['\"]?[[:space:]]*:" "$workflow"; then
    fail "forbidden YAML key is present: $forbidden_yaml_key"
  fi
done

for forbidden in \
  'push: false' \
  'actions/checkout@' \
  'private/' \
  'private.' \
  'BRAIN_MODEL_KEY' \
  'BRAIN_PASSWORD_HASH'; do
  if rg -Fq "$forbidden" "$workflow"; then
    fail "forbidden publish input or event is present: $forbidden"
  fi
done

github_token_key_count="$(
  sed -nE "/^[[:space:]]*['\"]?github-token['\"]?[[:space:]]*:/p" "$workflow" \
    | wc -l \
    | tr -d '[:space:]'
)"
[[ "$github_token_key_count" == 1 ]] \
  || fail "build-push-action must contain exactly one github-token input"
build_push_with_token_count="$(
  awk '
    /^      - / {
      in_build_push_step = 0
      in_with = 0
    }

    $0 == "        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0" {
      in_build_push_step = 1
      next
    }

    in_build_push_step && /^        with:[[:space:]]*$/ {
      in_with = 1
      next
    }

    in_build_push_step && in_with && /^        [^[:space:]]/ {
      in_with = 0
    }

    in_build_push_step && in_with && $0 == "          github-token: \047\047" {
      token_count++
    }

    END {
      print token_count + 0
    }
  ' "$workflow"
)"
[[ "$build_push_with_token_count" == 1 ]] \
  || fail "build-push-action with block must contain exactly one empty github-token input"

secret_expressions="$(rg -o '\$\{\{ secrets\.[^}]+ \}\}' "$workflow" || true)"
[[ "$secret_expressions" == '${{ secrets.GITHUB_TOKEN }}' ]] \
  || fail "GITHUB_TOKEN login must be the only secret expression"

if rg -n 'uses:[[:space:]]+[^[:space:]]+@(v[0-9]+|main|master)([[:space:]]|$)' "$workflow"; then
  fail "an action is not pinned to a full commit SHA"
fi

echo "Brain Ask publish workflow verification passed."
