# Phase 04 — DNS 전환과 원본 포트 차단

**Execution profile**: deep

---

## 목표

권한 DNS를 Cloudflare로 전환하고 검증이 끝난 뒤 홈서버의 공인 HTTP·HTTPS 진입점을 닫는다.

**범위 외**: 도메인 등록기관 이전과 Hermes·9119의 Tunnel 공개는 하지 않는다.

---

## 작업 항목 (5)

### 1. DNS와 DNSSEC 전환 전 점검

hosting.kr의 현재 A·TXT 레코드와 TTL을 새 스냅샷으로 저장하고 Cloudflare 가져오기 결과와 대조한다.
폐기된 `career`는 없어야 하며 `brain`만 새로 추가한다.
DS·DNSKEY가 없는지 다시 확인한다.
DS가 있으면 먼저 제거되고 전파가 확인될 때까지 네임서버를 바꾸지 않는다.

### 2. Tunnel DNS 경로 준비

apex와 필요한 하위 도메인을 Cloudflare Tunnel 대상으로 연결한다.
기존 TXT 레코드 두 개는 값과 TTL을 유지한다.
Tunnel의 마지막 ingress는 404 응답이어야 한다.

### 3. 권한 네임서버 전환

Phase 02의 내부 원본·Tunnel 상태와 Phase 03의 Access 객체·Jenkins HMAC 사전 검증이 모두 통과한 경우에만 hosting.kr에서 권한 네임서버를 Cloudflare 지정값으로 교체한다.
Cloudflare 영역이 Active가 되고 외부 권한 서버 응답과 각 서비스 응답이 일치할 때까지 기다린다.
이 조건 전에는 NPM 공인 포트를 변경하지 않는다.

### 4. Cloudflare 경유 검증과 원본 80·443 차단

NPM Compose와 관련 방화벽 설정을 백업한다.
공개 호스트의 기존 응답, 보호 호스트의 실제 Access 로그인과 허용 계정 접근, Jenkins 정상·오류 HMAC을 Cloudflare 경유로 먼저 검사한다.
하나라도 실패하면 원본 포트를 그대로 두고 전환을 중단한다.
호스트의 NPM 80·443 게시를 loopback으로만 제한하고 컨테이너의 `public-net` 연결은 유지한다.
SSH 10022와 기존 9119 SSH 포워딩 경로는 바꾸지 않는다.

### 5. 최종 검증과 작업 상태 갱신

공개 호스트의 대표 경로, 보호 호스트의 로그인과 허용 계정 접근, Jenkins 정상·오류 HMAC, `brain`의 public-only 콘텐츠를 원본 차단 뒤 외부에서 다시 검사한다.
공인 주소의 80·443 직접 접속은 실패하고 SSH 10022는 유지되는지 확인한다.
Cloudflare DNSSEC를 활성화하고 등록기관에 새 DS를 반영한 뒤 검증한다.
모든 검사가 성공한 경우에만 `index.json`을 `completed`와 마지막 phase로 갱신한다.

## Critical Files

| 대상 | 변경 |
| --- | --- |
| Cloudflare DNS | Tunnel 대상 레코드, 기존 TXT 보존 |
| hosting.kr nameserver | Cloudflare 권한 서버로 변경 |
| NPM Compose | 호스트 80·443 loopback 바인딩 |
| Cloudflare DNSSEC | 새 DS 발급과 등록 |
| `tasks/plan2-cloudflare-access-home-server/index.json` | 성공 뒤 완료 상태 기록 |

## 검증

```bash
# cwd: 외부 점검용 호스트
dig NS fosworld.co.kr +short
dig DS fosworld.co.kr +short
curl -I https://fosworld.co.kr
curl -I https://blog.fosworld.co.kr
curl -I https://accountbook.fosworld.co.kr
curl -I https://brain.fosworld.co.kr
nc -vz 61.80.30.85 10022
```

추가로 공인 주소 80·443은 도메인 Host 헤더를 넣어도 원본 서비스에 도달하지 않아야 한다.
Access 세션이 없는 보호 호스트는 로그인으로 이동하고 공개 호스트는 로그인 없이 기존 응답을 유지해야 한다.

## 중단 조건과 되돌리기

- Cloudflare 영역이 Active가 아니거나 공개·보호·웹훅 검사 중 하나라도 실패하면 원본 포트를 닫지 않는다.
- 전환 뒤 장애가 나면 NPM 공인 바인딩을 먼저 복구하고 Cloudflare DNS를 스냅샷의 A 레코드로 되돌린다.
- Cloudflare 자체 장애가 지속될 때만 hosting.kr 권한 네임서버 복귀를 수행한다.
- 복구 뒤 서비스 응답과 SSH 접근을 다시 검증하며 실패 상태에서는 `index.json`을 완료로 바꾸지 않는다.

## 의도 메모 (왜)

- DNS와 원본 포트 변경을 분리해 Tunnel이 검증되기 전 직접 공개 경로를 잃지 않게 한다.
- Bypass 웹훅의 공개성을 Jenkins HMAC 검증으로 보완한다.
