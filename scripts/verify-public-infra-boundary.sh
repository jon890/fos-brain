#!/usr/bin/env bash
# 공개 저장소에 적으면 안 되는 운영 정보가 들어갔는지 검사한다.
#
# 판정 기준은 CLAUDE.md 의 「공개 저장소」 절이 소유한다.
#
# **이 파일에 감출 값을 적지 않는다.**
# 여기 적으면 무엇을 감추는지가 아니라 감추려던 값 자체가 공개된다.
# 실제로 이 파일이 값 목록을 그대로 담고 있어 한 번 새어 나갔다.
# 그래서 두 층으로 나눈다.
#
#   형태 패턴   key 를 꺼내는 명령처럼 값이 아니라 모양인 것. 이 파일이 갖는다
#   값 목록     컨테이너 이름, 포트, 경로처럼 우리 환경의 값. 비공개 저장소가 갖는다
#
# 값 목록은 비공개 저장소 fos-home-infra 의 `config/` 아래에서 읽는다.
# 한 줄에 확장 정규식 하나이고 `#` 로 시작하는 줄은 건너뛴다.
# 그 저장소가 없으면 형태 패턴만 검사하고 그 사실을 알린다.
#
# 저장소마다 허용하는 낱말이 다르므로 목록도 저장소마다 나눈다.
# 이 저장소는 자기 GitHub 저장소 이름과 자기 코드의 식별자를 정상으로 쓴다.
#
# 종료 코드
#   0  찾지 못했다
#   1  의심스러운 줄을 찾았다
#   2  검사를 돌리지 못했다
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DENYLIST="${PUBLIC_REPO_DENYLIST:-$HOME/personal/fos-home-infra/config/public-repo-denylist-fos-brain.txt}"

found=0

report() {
  echo "[$2]"
  echo "$1" | sed 's/^/  /'
  echo
  found=1
}

# 이 저장소에 두지 않기로 한 디렉터리다.
if [[ -e deploy ]]; then
  report "deploy/" "공개 저장소가 배포 디렉터리를 추적한다"
fi

# 비공개 저장소로 옮긴 문서가 되돌아왔는지 본다.
for path in \
  docs/adr/002-cloudflare-tunnel-access-boundary.md \
  docs/adr/003-protected-private-quartz-release.md \
  tasks/plan2-cloudflare-access-home-server \
  tasks/plan3-protected-private-brain \
  tasks/plan6-hermes-qmd-search \
  tasks/plan4-memory-constellation/phase-05.md
do
  [[ -e "$path" ]] && report "$path" "비공개 저장소가 갖는 문서가 공개 저장소에 있다"
done

# 검사에서 빼는 것.
# CLAUDE.md 를 빼지 않는다. 그 문서에 값을 예시로 적어 새어 나간 전례가 있다.
# `quartz/docs` 는 upstream Quartz 를 그대로 가져온 문서라 우리 환경을 가리키지 않는다.
EXCLUDES=(
  ':(exclude)scripts/verify-public-infra-boundary.sh'
  ':(exclude)scripts/verify-public-infra-boundary.test.sh'
  ':(exclude)quartz/docs'
)

# 값이 아니라 모양이라 이 파일에 적어도 된다.
# 변수로 받은 이름은 값이 아니므로 리터럴로 적은 자리만 찾는다.
SHAPES=(
  '(^|[^[:alnum:]_/.$-])/home/[a-z][a-z0-9_-]*/::호스트의 홈 디렉터리 경로'
  'docker[[:space:]]+(exec|cp)([[:space:]]+-[a-zA-Z-]+)*[[:space:]]+[a-z][a-z0-9_-]*[[:space:]]::리터럴 컨테이너 이름으로 명령을 돌리는 방법'
  'docker[[:space:]]+network[[:space:]]+(create|connect)::Docker 네트워크를 다루는 명령'
  '[A-Z][A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|APIKEY)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9/+_.-]{16,}::비밀값으로 보이는 리터럴'
  'ssh[[:space:]]+[a-z][a-z0-9_.-]*[[:space:]]+(curl|grep|cat|docker|sed|awk|tail)::홈서버에서 명령을 돌리는 방법'
)

for entry in "${SHAPES[@]}"; do
  pattern="${entry%%::*}"
  reason="${entry#*::}"
  # git 이 추적하는 파일만 본다. .gitignore 아래는 공개되지 않는다.
  if hits=$(git grep -nE "$pattern" -- . "${EXCLUDES[@]}" 2>/dev/null); then
    report "$hits" "$reason"
  fi
done

# 공인 IP 주소는 값을 적지 않고도 모양으로 찾을 수 있다.
# 사설 대역과 loopback, 문서용 대역은 우리 환경을 가리키지 않으므로 뺀다.
if ip_hits=$(git grep -nE '(^|[^0-9.])([0-9]{1,3}\.){3}[0-9]{1,3}([^0-9.]|$)' -- . "${EXCLUDES[@]}" 2>/dev/null); then
  public_ip_hits=$(
    echo "$ip_hits" | grep -Ev '(^|[^0-9.])(10\.|127\.|0\.0\.0\.0|255\.255\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)' || true
  )
  [[ -n "$public_ip_hits" ]] && report "$public_ip_hits" "공인 IP 주소"
fi

if [[ -r "$DENYLIST" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    case "$line" in \#*) continue ;; esac
    if hits=$(git grep -nE "$line" -- . "${EXCLUDES[@]}" 2>/dev/null); then
      report "$hits" "비공개 목록에 걸렸다"
    fi
  done < "$DENYLIST"
else
  echo "알림: 값 목록을 읽지 못해 형태 패턴만 검사했다."
  echo "  찾은 자리: $DENYLIST"
  echo "  그 파일은 비공개 저장소 fos-home-infra 가 소유한다."
  echo "  경로가 다르면 PUBLIC_REPO_DENYLIST 로 준다."
  echo
fi

# 공개 Quartz 산출물에 비공개 네임스페이스의 페이지가 섞였는지 본다.
# 아래는 우리 환경의 값이 아니라 회귀 검사가 쓰는 fixture 이름이다.
public_artifacts=()
if [[ -d quartz/public ]]; then
  while IFS= read -r -d '' artifact; do
    public_artifacts+=("$artifact")
  done < <(
    find quartz/public -type f \( \
      -name '*.html' -o \
      -name 'contentIndex.json' -o \
      -name 'memory-atlas-index.json' -o \
      -name 'memory-atlas-semantics.json' -o \
      -name 'sitemap.xml' -o \
      -name 'index.xml' \
    \) -print0
  )
fi

if [[ ${#public_artifacts[@]} -gt 0 ]]; then
  if hits=$(grep -nE 'private-auth-fixture|Private Auth Fixture|protected fixture|private-secret-rag|Private Shadow Node' "${public_artifacts[@]}" 2>/dev/null); then
    report "$hits" "공개 Quartz 산출물에 비공개 fixture 가 들어갔다"
  fi
fi

if [[ "$found" -eq 0 ]]; then
  echo "통과: 공개 저장소에 적으면 안 되는 것을 찾지 못했다"
  exit 0
fi

cat <<'GUIDE'
위 줄을 고친다. 판정 기준은 CLAUDE.md 의 「공개 저장소」 절이다.

- 무엇을 확인해야 하는지만 적고, 실행 방법은 fos-home-infra 를 가리킨다
- 측정한 결과 수치는 적어도 된다. 그것을 얻은 명령을 적지 않는 것이다
- 조사 기록은 저장소 밖에 둔다
GUIDE
exit 1
