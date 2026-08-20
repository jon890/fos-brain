# Phase 04: DNS 전환과 원본 포트 차단

**Execution profile**: deep

---

## 목표

권한 DNS를 Cloudflare로 전환하고 검증이 끝난 뒤 홈서버의 공인 HTTP·HTTPS 진입점을 닫는다.

**범위 외**: 도메인 등록기관 이전과 Hermes·9119의 Tunnel 공개는 하지 않는다.

---

## 작업 항목 (6)

### 1. DNS와 DNSSEC 전환 전 점검

hosting.kr의 현재 A·TXT 레코드와 TTL을 새 스냅샷으로 저장하고 Cloudflare 가져오기 결과와 대조한다.
폐기된 `career`와 `nreview`는 없어야 하며 `brain`만 새로 추가한다.
DS·DNSKEY가 없는지 다시 확인한다.
DS가 있으면 먼저 제거되고 전파가 확인될 때까지 네임서버를 바꾸지 않는다.

### 2. Tunnel DNS 경로 준비

apex와 필요한 하위 도메인을 Cloudflare Tunnel 대상으로 연결한다.
기존 TXT 레코드 두 개는 값과 TTL을 유지한다.
Tunnel의 마지막 ingress는 404 응답이어야 한다.

### 3. 보호 호스트 격리

Phase 02의 내부 원본·Tunnel 상태와 Phase 03의 로그인 수단·Allow 정책·Jenkins HMAC 검증이 모두 통과해야 한다.
Tunnel 구성을 백업한 뒤 `brain`, Grafana, Jenkins, NPM의 ingress를 `http_status:503`으로 바꾼다.
Jenkins 전체를 격리하므로 웹훅 경로도 같은 기간 503을 반환한다.
apex, blog, accountbook, accountbook-api는 NPM 원본을 유지한다.
저장 상태를 다시 읽어 보호 호스트가 원본을 가리키지 않는지 확인한 뒤에만 네임서버를 바꾼다.

### 4. 권한 네임서버 전환과 Access 구성

hosting.kr에서 권한 네임서버를 Cloudflare 지정값으로 교체한다.
Cloudflare 영역이 Active가 되고 외부 권한 서버 응답과 각 서비스 응답이 일치할 때까지 기다린다.
Active 확인 직후 `brain`, Grafana, Jenkins, NPM의 self-hosted 애플리케이션에 허용 계정 Allow 정책을 연결한다.
`jenkins.fosworld.co.kr/generic-webhook-trigger/*`에는 Jenkins 전체 애플리케이션보다 구체적인 Bypass 애플리케이션을 만든다.
애플리케이션과 정책의 저장 상태·대상·경로 우선순위를 다시 읽어 검증한 뒤에만 보호 ingress를 NPM 원본으로 복구한다.
이 조건 전에는 NPM 공인 포트를 변경하지 않는다.

### 5. Cloudflare 경유 검증과 원본 80·81·443 차단

NPM Compose와 관련 방화벽 설정을 백업한다.
공개 호스트의 기존 응답, 보호 호스트의 실제 Access 로그인과 허용 계정 접근, Jenkins 정상·오류 HMAC을 Cloudflare 경유로 먼저 검사한다.
하나라도 실패하면 원본 포트를 그대로 두고 전환을 중단한다.
호스트의 NPM 80·81·443 게시를 loopback으로만 제한하고 컨테이너의 `public-net` 연결은 유지한다.
SSH 10022와 기존 9119 SSH 포워딩 경로는 바꾸지 않는다.

### 6. 최종 검증과 작업 상태 갱신

공개 호스트의 대표 경로, 보호 호스트의 로그인과 허용 계정 접근, Jenkins 정상·오류 HMAC, `brain`의 public-only 콘텐츠를 원본 차단 뒤 외부에서 다시 검사한다.
공인 주소의 80·81·443 직접 접속은 실패하고 SSH 10022는 유지되는지 확인한다.
Cloudflare DNSSEC를 활성화하고 등록기관에 새 DS를 반영한 뒤 검증한다.
모든 검사가 성공한 경우에만 `index.json`을 `completed`와 마지막 phase로 갱신한다.

## Critical Files

| 대상 | 변경 |
| --- | --- |
| Cloudflare DNS | Tunnel 대상 레코드, 기존 TXT 보존 |
| Cloudflare Tunnel | 보호 호스트 503 격리와 검증 뒤 HTTPS NPM 원본 복구 |
| Cloudflare Access | 보호 호스트 Allow와 Jenkins 웹훅 Bypass |
| hosting.kr nameserver | Cloudflare 권한 서버로 변경 |
| NPM Compose | 호스트 80·81·443 loopback 바인딩 |
| Cloudflare DNSSEC | 새 DS 발급과 등록 |
| `tasks/plan2-cloudflare-access-home-server/index.json` | 성공 뒤 완료 상태 기록 |

## 검증

```bash
# cwd: 외부 점검용 호스트
dig NS fosworld.co.kr +short
dig DS fosworld.co.kr +short
curl -L --max-redirs 10 --output /dev/null --write-out '%{http_code}\n' https://fosworld.co.kr
curl -L --max-redirs 10 --output /dev/null --write-out '%{http_code}\n' https://blog.fosworld.co.kr
curl -L --max-redirs 10 --output /dev/null --write-out '%{http_code}\n' https://accountbook.fosworld.co.kr
curl -L --max-redirs 10 --output /dev/null --write-out '%{http_code}\n' https://accountbook-api.fosworld.co.kr
curl -I https://brain.fosworld.co.kr
nc -vz 61.80.30.85 10022
```

추가로 공인 주소 80·81·443은 도메인 Host 헤더를 넣어도 원본 서비스에 도달하지 않아야 한다.
Access 세션이 없는 보호 호스트는 로그인으로 이동하고 공개 호스트는 로그인 없이 기존 응답을 유지해야 한다.

## 실행 결과 (2026-08-20)

- hosting.kr의 권한 네임서버를 Cloudflare 지정값으로 바꿨고 Cloudflare 영역이 Active 상태가 됐다.
- Cloudflare 권한 DNS에는 Tunnel CNAME 8개와 기존 TXT 2개가 남았으며 `career`와 `nreview`는 없다.
- Access 애플리케이션 6개는 보호 호스트 네 개, Jenkins 웹훅 Bypass, `brain` ACME Bypass로만 구성했다.
- 공개 호스트 네 개와 `career`, `nreview`에는 Access 애플리케이션이 없다.
- `brain`, Grafana, Jenkins, NPM의 일반 경로에는 허용 계정 Allow 정책을 연결했다.
- Jenkins 웹훅 경로에는 더 구체적인 Bypass를 적용했고 정상 HMAC dry-run은 200, 누락·오류 HMAC은 403을 반환했다.
- Jenkins 검증 전후의 작업 build 번호는 바뀌지 않았다.
- 공개 호스트 네 개와 보호 호스트 네 개의 Tunnel 원본을 `https://fos-npm:443`으로 통일했다.
- 각 Tunnel 항목은 원래 호스트 이름을 SNI와 Host 헤더로 사용하며 NPM 인증서 검증을 유지한다.
- `brain`에는 호스트 이름과 일치하는 인증서를 발급해 연결했고 정확한 ACME challenge 경로만 Access를 우회한다.
- 공개 호스트의 리다이렉트는 최종 응답까지 추적해 반복이 없고 보호 호스트는 인증하지 않은 요청을 Access 로그인으로 보낸다.
- NPM의 호스트 80·81·443은 loopback으로 제한했고 `public-net`, SSH 10022, 기존 9119 SSH 포워딩 경로는 유지했다.
- 공인 주소의 80·81·443 직접 접속은 실패하며 Cloudflare 경유 서비스는 기존 대표 응답을 유지한다.
- `brain` 산출물은 public 파일만 포함하며 private 경로와 호스트 포트가 없다.
- Cloudflare DNSSEC와 등록기관 DS가 활성 상태이며 재귀 확인 결과에서 AD(Authenticated Data) 표시를 확인했다.
- Connector와 관련 컨테이너가 정상이고 최근 치명 오류가 없음을 다시 확인했다.

## 중단 조건과 되돌리기

- Cloudflare 영역이 Active가 아니거나 Access 애플리케이션 생성·검증이 실패하면 보호 ingress를 503으로 유지하고 원본 포트를 닫지 않는다.
- 격리 중 실패한 GitHub webhook delivery는 복구 뒤 재전송한다.
- 전환 뒤 장애가 나면 NPM의 80·81·443 공인 바인딩을 먼저 복구하고 Cloudflare DNS를 스냅샷의 A 레코드로 되돌린다.
- Access를 만들 수 없는 상태가 길어지면 Cloudflare DNS 또는 권한 네임서버를 이전 상태로 되돌린다.
- Cloudflare 자체 장애가 지속될 때만 hosting.kr 권한 네임서버 복귀를 수행한다.
- 복구 뒤 서비스 응답과 SSH 접근을 다시 검증하며 실패 상태에서는 `index.json`을 완료로 바꾸지 않는다.

## 의도 메모 (왜)

- DNS와 원본 포트 변경을 분리해 Tunnel이 검증되기 전 직접 공개 경로를 잃지 않게 한다.
- Bypass 웹훅의 공개성을 Jenkins HMAC 검증으로 보완한다.
