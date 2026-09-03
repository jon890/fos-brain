# Phase 01 NestJS BFF 기반과 기존 질문 기능 이관

**Execution profile**: deep

---

## 목표

`services/brain-ask`의 Node HTTP 서버를 NestJS 12 애플리케이션으로 바꾸되, 기존 Brain 근거 질문의 입력·검색·모델 호출·오류 응답 계약을 그대로 유지한다.

**범위 외**: 로그인, session, private 콘텐츠 API는 Phase 02가 담당하고 Memory Atlas 화면 변경은 Phase 03이 담당한다.

**선행 조건**: Node 24.15.0과 pnpm 10.33.0을 사용한다. 기존 `brainAsk.mjs` 단위 검사를 먼저 실행해 이관 전 기준을 기록한다.

---

## 작업 항목 (4)

### 1. NestJS 12 애플리케이션 골격

`services/brain-ask`를 ESM NestJS 12 애플리케이션으로 구성한다.
Express adapter, `@nestjs/config`, `class-validator`, `class-transformer`, Helmet과 Vitest를 사용한다.
전역 prefix는 `api`로 두고 `ValidationPipe`의 whitelist와 transform을 켠다.
새 별도 서비스 디렉터리를 만들지 않고 기존 image와 배포 경로를 유지한다.

### 2. 질문 도메인 이관

현재 `brainAsk.mjs`의 질문 검증, qmd URI 제한, 근거 수집, 모델 응답 추출과 크기 제한을 `BrainAskModule`의 controller와 provider로 옮긴다.
외부 qmd와 모델 호출은 주입 가능한 client 경계로 분리해 단위 검사에서 실제 network를 쓰지 않는다.
질문·답변·근거 본문을 로그에 남기지 않고 기존 `requestId`, 오류 code, 재시도 가능 여부와 동시 요청 1개 제한을 보존한다.

`POST /api/brain/ask`를 최종 경로로 사용한다.
이 phase에서는 인증 Guard를 빈 경계로 두지 말고 endpoint 자체를 내부 전용으로 표시한 뒤 Phase 02에서 관리자 Guard를 연결한다.

### 3. 설정과 종료 계약

포트, qmd URL, 모델 URL, key 파일, public·private wiki root와 기존 timeout·크기 제한을 schema로 검증한다.
필수 설정이 없거나 숫자 범위가 잘못되면 요청 시점이 아니라 시작 단계에서 실패한다.
종료 signal을 받으면 Nest 애플리케이션과 진행 중 fetch를 정리한다.
운영 주소와 비밀값은 예시 파일에도 넣지 않는다.

### 4. 컨테이너와 회귀 검사

multi-stage Dockerfile로 TypeScript를 빌드하고 production 의존성과 컴파일 결과만 실행 image에 둔다.
non-root user, Node 24.15.0 고정, `/api/brain/ask`와 health endpoint를 검사한다.
기존 fixture가 검증하던 traversal, 심볼릭 링크 탈출, 본문 한도, 모델 오류와 빈 근거 동작을 새 Vitest 검사로 이관한다.

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

## 검증

```bash
# cwd: <worktree>/
node --test services/brain-ask/brainAsk.test.mjs
```

```bash
# cwd: <worktree>/services/brain-ask
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

```bash
# cwd: <worktree>/
docker build -f services/brain-ask/Dockerfile .
scripts/verify-public-infra-boundary.sh
git diff --check
```

기존 질문 fixture와 새 NestJS endpoint가 같은 정상·빈 근거·오류 계약을 반환해야 한다.
이관이 끝난 뒤 사용하지 않는 `server.mjs`는 삭제하고, 순수 도메인 함수는 TypeScript source 하나만 단일 소스로 둔다.

## 의도 메모 (왜)

- 기존 배포 경로를 유지해 애플리케이션 전환과 인프라 경로 변경을 한 번에 겹치지 않는다.
- Nest module, controller, provider와 Guard 경계로 인증과 질문 기능의 책임을 분리한다.
- 이관 전 회귀를 먼저 실행해 프레임워크 변경이 질문 품질이나 보안 제한을 바꾸지 않게 한다.
