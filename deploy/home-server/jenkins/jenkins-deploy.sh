#!/bin/bash
#
# Jenkins 전용 SSH forced-command 스크립트.
#
# ~/.ssh/authorized_keys 의 command= 옵션으로 강제 실행된다. 클라이언트(Jenkins)가
# 요청한 명령은 실행되지 않고 SSH_ORIGINAL_COMMAND 로만 전달되며, 아래 고정 목록과
# 정확히 일치할 때만 동작한다.
#
# [중요] SSH_ORIGINAL_COMMAND 를 절대 eval 하거나 셸 확장/명령 인자로 흘려보내지 말 것.
#        그러면 임의 명령 실행이 되살아나고 이 스크립트의 존재 의미가 없어진다.
#        반드시 아래처럼 고정 문자열 case 매칭만 사용한다.
#
set -euo pipefail

APPS=/home/bifos/apps

# 배포는 ~/.docker/config.json(사용자 대화형 로그인 상태)에 의존하지 않는다.
# 전용 빈 설정을 써서 항상 익명으로 pull 한다 — 대상 이미지는 모두 공개다.
# 이유: bifos 의 ghcr.io 자격증명이 만료되어 있었고, 만료된 자격증명이 있으면
#       Docker가 그걸 전송해 GHCR이 denied 로 거부한다(자격증명이 아예 없을 때보다 나쁘다).
# 비공개 이미지가 생기면 이 디렉터리에 docker login 하면 된다:
#   DOCKER_CONFIG=/home/bifos/.config/jenkins-deploy-docker docker login ghcr.io
export DOCKER_CONFIG=/home/bifos/.config/jenkins-deploy-docker

log() {
  logger -t jenkins-deploy -- "$*" 2>/dev/null || true
  echo "$*"
}

deploy() {
  # $1 은 이 스크립트 내부에서만 정해지는 고정 값이다 (외부 입력 아님).
  local dir="$1" name="$2"
  local file="$APPS/$dir/docker-compose.yml"
  log "==> pull: $dir"
  docker compose -f "$file" pull
  log "==> up: $dir"
  docker compose -f "$file" up -d
  log "==> status:"
  docker ps --filter "name=$name" --format '{{.Names}} {{.Status}}'
}

case "${SSH_ORIGINAL_COMMAND:-}" in
  deploy-blog)
    deploy blog fos-blog
    ;;
  deploy-accountbook-be)
    deploy accountbook-be accountbook-backend
    ;;
  deploy-accountbook-fe)
    deploy accountbook-fe accountbook-frontend
    ;;
  prune)
    log "==> docker system prune -f"
    docker system prune -f
    ;;
  sync-blog)
    # blog 의 sync API 를 호출한다. API 키는 여기서만 읽으므로 Jenkins 는
    # 키를 볼 필요가 없다 (Jenkins 는 이 동작 이름만 보낼 수 있다).
    # 키가 로그·프로세스 목록에 남지 않도록 헤더는 stdin 으로 전달한다.
    log "==> sync blog"
    key=$(awk -F= '/^SYNC_API_KEY=/{print $2}' "$APPS/blog/.env")
    [ -n "$key" ] || { echo "SYNC_API_KEY 를 blog/.env 에서 찾지 못했습니다" >&2; exit 1; }
    response=$(printf 'Authorization: Bearer %s\n' "$key" \
      | curl -s -H @- -X POST http://127.0.0.1:13000/api/sync)
    unset key
    echo "$response"
    echo "$response" | grep -q '"success":true'
    ;;
  sync-brain)
    # 배포 환경은 mode 600 파일에서 읽고, 외부 입력은 고정 명령 이름 외에 받지 않는다.
    set -a
    # shellcheck source=/dev/null
    source "$APPS/fos-brain-deploy/.env"
    set +a
    log "==> sync protected brain"
    "$APPS/fos-brain-deploy/sync-protected.sh"
    ;;
  sync-brain-qmd)
    log "==> sync brain qmd"
    "$APPS/fos-brain-deploy/sync-qmd.sh"
    ;;
  *)
    log "DENIED: ${SSH_ORIGINAL_COMMAND:-<empty>}"
    echo "허용되지 않은 명령입니다." >&2
    echo "사용 가능: deploy-blog | deploy-accountbook-be | deploy-accountbook-fe | prune | sync-blog | sync-brain | sync-brain-qmd" >&2
    exit 1
    ;;
esac
