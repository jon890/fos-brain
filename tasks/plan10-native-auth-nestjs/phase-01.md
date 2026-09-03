# Phase 01 NestJS BFF 기반과 기존 질문 기능 이관

**Execution profile**: deep

---

## 목표

`services/brain-ask`의 Node HTTP 서버를 NestJS 12 애플리케이션으로 바꾸되, 기존 Brain 근거 질문의 입력·검색·모델 호출·오류 응답 계약을 그대로 유지한다.

**범위 외**: 로그인, session, private 콘텐츠 API와 production 질문 route 등록은 Phase 02가 담당하고 Memory Atlas 화면 변경은 Phase 03이 담당한다.

**선행 조건**: Node 24.15.0을 사용한다. 기존 `brainAsk.mjs` 단위 검사는 어떤 이관 파일도 수정하기 전에 한 번 실행해 이관 전 기준을 기록한다.

---

## 작업 항목 (5)

### 1. NestJS 12 애플리케이션 골격

`services/brain-ask`를 ESM NestJS 12 애플리케이션으로 구성한다.
Express adapter, `@nestjs/config`, `class-validator`, `class-transformer`, Helmet과 Vitest를 사용한다.
전역 prefix는 `api`로 두고 `ValidationPipe`의 whitelist와 transform을 켠다.
새 별도 서비스 디렉터리를 만들지 않고 기존 image와 배포 경로를 유지한다.
`services/brain-ask/package.json`의 `packageManager`는 `pnpm@10.33.0`으로 고정하고 설치·검사·빌드와 Docker build에서도 `corepack pnpm@10.33.0`을 실행한다.

### 2. 질문 도메인 이관

현재 `brainAsk.mjs`의 질문 검증, qmd URI 제한, 근거 수집, 모델 응답 추출과 크기 제한을 `BrainAskModule`의 controller와 provider로 옮긴다.
외부 qmd와 모델 호출은 주입 가능한 client 경계로 분리해 단위 검사에서 실제 network를 쓰지 않는다.
질문·답변·근거 본문을 로그에 남기지 않고 기존 `requestId`, 오류 code, 재시도 가능 여부와 동시 요청 1개 제한을 보존한다.

controller의 최종 경로는 `POST /api/brain/ask`로 정의하되 이 phase의 production `AppModule`에는 `BrainAskModule`이나 controller를 등록하지 않는다.
Vitest의 Nest test application에서만 route 계약을 검사하고 production build에서는 `/api/brain/ask`가 `404`인지 확인한다.
Phase 02가 `AdminGuard`와 route 등록을 같은 변경으로 추가하기 전에는 인증되지 않은 질문 route가 노출되면 안 된다.

### 3. 설정과 종료 계약

포트, qmd URL, 모델 URL, key 파일, public·private wiki root와 기존 timeout·크기 제한을 schema로 검증한다.
필수 설정이 없거나 숫자 범위가 잘못되면 요청 시점이 아니라 시작 단계에서 실패한다.
종료 signal을 받으면 Nest 애플리케이션과 진행 중 fetch를 정리한다.
운영 주소와 비밀값은 예시 파일에도 넣지 않는다.

### 4. 컨테이너와 회귀 검사

multi-stage Dockerfile로 TypeScript를 빌드하고 production 의존성과 컴파일 결과만 실행 image에 둔다.
non-root user, Node 24.15.0 고정, health endpoint 성공과 `/api/brain/ask`의 `404`를 검사한다.
기존 fixture가 검증하던 traversal, 심볼릭 링크 탈출, 본문 한도, 모델 오류와 빈 근거 동작을 새 Vitest 검사로 이관한다.
새 검사가 기존 계약을 모두 대체하면 `brainAsk.mjs`, `brainAsk.test.mjs`와 `server.mjs`를 삭제해 TypeScript와 Vitest만 실행 가능한 단일 소스로 남긴다.

### 5. 공개 인프라 경계 검사의 제품명 구분

`scripts/verify-public-infra-boundary.sh`가 `Cloudflare Access`, `Cloudflare Tunnel`과 `cloudflared` 같은 제품·도구 이름만으로 실패하지 않게 한다.
배포 경로, 실제 host·domain·IP, network·container 이름과 `TUNNEL_TOKEN` 같은 운영 설정 식별자는 계속 거부한다.
임시 fixture에 제품 이름만 있으면 통과하고 실제 운영 식별자가 있으면 실패하는 shell 회귀 검사를 추가한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/brain-ask/package.json` | NestJS 12 ESM, build·lint·test 명령 정의 |
| `services/brain-ask/pnpm-lock.yaml` | BFF 의존성 버전 고정 |
| `services/brain-ask/src/main.ts` | Nest bootstrap, 보안 middleware와 종료 처리 |
| `services/brain-ask/src/app.module.ts` | 설정과 기능 module 조합 |
| `services/brain-ask/src/brain-ask/` | 기존 질문 도메인 controller·provider·DTO 이관 |
| `services/brain-ask/src/config/` | 환경 변수 검증과 typed 설정 |
| `services/brain-ask/test/` | 기존 질문 API와 보안 경계 회귀 이관 |
| `services/brain-ask/Dockerfile` | NestJS production image로 전환 |
| `services/brain-ask/brainAsk.mjs` | TypeScript 이관 뒤 삭제 |
| `services/brain-ask/brainAsk.test.mjs` | Vitest 이관 뒤 삭제 |
| `services/brain-ask/server.mjs` | Nest bootstrap 이관 뒤 삭제 |
| `scripts/verify-public-infra-boundary.sh` | 제품 이름과 운영 식별자 구분 |
| `scripts/verify-public-infra-boundary.test.sh` | 허용 제품 이름과 차단 운영 식별자 회귀 |

## 검증

```bash
# 이관 작업을 시작하기 전 기준 기록에서만 실행한다.
# cwd: <worktree>/
node --test services/brain-ask/brainAsk.test.mjs
```

```bash
# cwd: <worktree>/services/brain-ask
corepack pnpm@10.33.0 install --frozen-lockfile
corepack pnpm@10.33.0 test
corepack pnpm@10.33.0 lint
corepack pnpm@10.33.0 build
```

```bash
# cwd: <worktree>/
docker build -f services/brain-ask/Dockerfile .
bash scripts/verify-public-infra-boundary.test.sh
scripts/verify-public-infra-boundary.sh
test ! -e services/brain-ask/brainAsk.mjs
test ! -e services/brain-ask/brainAsk.test.mjs
test ! -e services/brain-ask/server.mjs
git diff --check
```

기존 질문 fixture와 새 NestJS endpoint가 같은 정상·빈 근거·오류 계약을 반환해야 한다.
이관 뒤에는 MJS 검사를 다시 실행하지 않으며 순수 도메인 함수와 검사는 TypeScript와 Vitest만 단일 소스로 둔다.
production image의 health endpoint는 성공하고 `/api/brain/ask`는 `404`여야 한다.

## 의도 메모 (왜)

- 기존 배포 경로를 유지해 애플리케이션 전환과 인프라 경로 변경을 한 번에 겹치지 않는다.
- Nest module, controller, provider와 Guard 경계로 인증과 질문 기능의 책임을 분리한다.
- 이관 전 회귀를 먼저 실행해 프레임워크 변경이 질문 품질이나 보안 제한을 바꾸지 않게 한다.
- 공개 저장소는 제품 결정을 설명할 수 있어야 하므로 제품 이름은 허용하고 재현 가능한 운영 식별자만 차단한다.
