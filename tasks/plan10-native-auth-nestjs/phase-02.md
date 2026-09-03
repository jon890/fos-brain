# Phase 02 관리자 session과 private API 경계

**Execution profile**: deep

---

## 목표

NestJS BFF에 단일 관리자 비밀번호 인증, 메모리 session, 역할 Guard와 private 콘텐츠 API를 구현해 private 데이터가 인증 전에는 응답되지 않게 한다.

**범위 외**: 여러 계정, 회원가입, 비밀번호 복구, OAuth, JWT, DB와 Redis는 만들지 않는다. 화면 로그인은 Phase 03이 담당한다.

**선행 조건**: Phase 01의 NestJS 애플리케이션과 TypeScript 질문 회귀가 통과하고 production `/api/brain/ask`는 아직 `404`여야 한다.

---

## 작업 항목 (5)

### 1. 비밀번호 hash 검증

`AuthModule`이 mode 600 secret 파일의 `scrypt$131072$8$1$<salt>$<hash>` 한 줄을 시작할 때 읽고 형식을 검사한다.
Node `crypto.scrypt`로 64바이트 derived key를 만들고 `maxmem`은 256 MiB로 고정한 뒤 `crypto.timingSafeEqual`로 비교한다.
salt는 16바이트 이상이어야 하며 비밀번호와 hash는 로그, 예외 본문과 응답에 넣지 않는다.

### 2. 제한된 opaque session 저장소

로그인 성공 시 `randomBytes(32)`의 원문 ID를 base64url cookie로 보내고 서버에는 SHA-256 hash만 map key로 저장한다.
session은 `admin`, 생성 시각, 만료 시각만 가지며 기본 12시간, 최대 8개다.
조회할 때 만료 항목을 정리하고 한도를 넘으면 가장 오래된 항목을 삭제한다.
프로세스 종료 뒤 복원하지 않는다.

cookie 이름은 `__Host-brain_session`이며 `Path=/`, `Secure`, `HttpOnly`, `SameSite=Strict`를 설정하고 `Domain`은 지정하지 않는다.

### 3. 인증 endpoint와 요청 보호

다음 endpoint를 구현한다.

- `POST /api/auth/login`: 비밀번호 확인, session 생성, 같은 실패 응답
- `GET /api/auth/session`: `public` 또는 `admin` 상태 반환
- `POST /api/auth/logout`: session 유무와 관계없이 폐기 후 `204`
- `GET /api/auth/authorize`: 관리자면 `204`, 아니면 `401`

모든 `POST` 요청은 `Origin` header가 있어야 하며 그 값의 origin이 설정한 Brain origin과 정확히 같아야 한다.
`Origin`이 없거나 다르면 거부하고 `Referer`로 대체 판정하지 않는다.
`AuthModule`의 `LoginAttemptLimiter` provider가 client별 로그인 시도를 15분에 5회까지 허용한다.
provider는 만료된 항목을 정리하고 최대 1,024개 client만 유지하며 한도를 넘으면 가장 오래된 항목을 삭제한다.
이 상태는 process 재시작 뒤 복원하지 않으며 NestJS 12의 peer 범위와 맞지 않는 외부 throttling package는 추가하지 않는다.
proxy를 무조건 신뢰하지 않고 운영 인프라가 지정한 hop만 client 주소 판정에 반영한다.

### 4. 관리자 Guard와 private 콘텐츠 API

`AdminGuard`는 server-side session만 읽고 브라우저가 보낸 role header나 본문 값은 무시한다.
Phase 01의 `BrainAskModule`과 controller를 production `AppModule`에 처음 등록하면서 `POST /api/brain/ask`에 `AdminGuard`를 함께 적용한다.
`GET /api/private/content-index`, `GET /api/private/memory-atlas-semantics`에도 같은 Guard를 적용한다.
private JSON endpoint는 설정한 read-only 파일 하나만 읽고 임의 경로를 입력받지 않는다.
인증과 private 응답에는 `Cache-Control: private, no-store`를 설정한다.

### 5. 인증·인가 단위 및 통합 검사

정상·실패 로그인, 같은 오류, hash 형식 오류, session 생성·만료·퇴출·재시작, cookie 속성과 로그아웃을 검사한다.
위조 cookie, 위조 role header, 누락·불일치 origin, `Referer`만 있는 요청, 제한 초과, 최대 client 한도, private 파일 누락과 session 없는 직접 호출이 fail-closed인지 확인한다.
질문 API는 관리자 session이 있을 때만 Phase 01의 기존 응답 계약을 수행해야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/brain-ask/src/auth/auth.module.ts` | 인증 provider와 endpoint 조합 |
| `services/brain-ask/src/auth/auth.controller.ts` | login·session·logout·authorize endpoint |
| `services/brain-ask/src/auth/password-hash.service.ts` | scrypt hash parser와 검증 |
| `services/brain-ask/src/auth/session-store.service.ts` | bounded opaque session 저장소 |
| `services/brain-ask/src/auth/login-attempt-limiter.service.ts` | 제한된 client별 로그인 시도 저장소 |
| `services/brain-ask/src/auth/admin.guard.ts` | 관리자 session 인가 |
| `services/brain-ask/src/auth/origin.guard.ts` | 상태 변경 요청의 same-origin 검사 |
| `services/brain-ask/src/private-content/` | 보호 색인과 관계 데이터 API |
| `services/brain-ask/src/brain-ask/brain-ask.controller.ts` | 관리자 Guard 적용 |
| `services/brain-ask/src/app.module.ts` | 보호된 질문 module과 route 등록 |
| `services/brain-ask/test/auth/` | 인증·인가와 fail-closed 회귀 |

## 검증

```bash
# cwd: <worktree>/services/brain-ask
corepack pnpm@10.33.0 test
corepack pnpm@10.33.0 lint
corepack pnpm@10.33.0 build
```

```bash
# cwd: <worktree>/
docker build -f services/brain-ask/Dockerfile .
scripts/verify-public-infra-boundary.sh
git diff --check
```

검사 fixture의 password hash와 private JSON은 임시 디렉터리에 만들고 종료 뒤 제거한다.
테스트 출력과 Docker layer에는 평문 비밀번호와 운영 secret 경로가 없어야 한다.

## 의도 메모 (왜)

- 단일 관리자와 단일 instance라는 현재 범위에서는 opaque 메모리 session이 가장 작은 폐기 가능한 권한 상태다.
- raw session ID를 서버에 저장하지 않아 메모리 노출 시 즉시 사용할 수 있는 credential을 줄인다.
- 애플리케이션 Guard와 reverse proxy 권한 확인 endpoint를 같은 session 판정에 연결한다.
- 로그인 시도 제한을 작은 provider로 두면 NestJS 12의 peer 범위를 벗어나는 패키지 없이 저장량과 재시작 동작을 명시할 수 있다.
