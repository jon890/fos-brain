# Phase 04 보안·브라우저·컨테이너 통합 검증

**Execution profile**: standard

---

## 목표

NestJS BFF와 Memory Atlas의 공개·관리자 경계를 한 번에 검증하고 private 인프라 계획이 사용할 image와 API 계약을 고정한다.

**범위 외**: 홈서버 배포, Nginx 변경과 Cloudflare Access 제거는 `fos-home-infra`의 `plan3-brain-native-auth`가 담당한다.

**선행 조건**: Phase 01부터 Phase 03까지의 단위·브라우저 검사가 모두 통과해야 한다.

---

## 작업 항목 (4)

### 1. 실제 process 통합 fixture

임시 password hash, public·protected JSON, mock qmd와 mock model을 사용해 production build의 NestJS process를 시작한다.
login 전 public session, BFF private API·질문 `401`, login 뒤 protected JSON·질문 성공, logout 뒤 재차단을 HTTP 수준에서 검사한다.
서버 재시작 뒤 기존 cookie가 무효인지 확인한다.

### 2. 보안 회귀

cookie 속성, security header, `Cache-Control`, CORS 미허용, origin 거부, body validation과 rate limit을 검사한다.
public Quartz 산출물의 HTML, 콘텐츠 색인, 관계 JSON, sitemap과 RSS에서 private fixture slug·제목·본문을 찾지 못해야 한다.
질문 응답의 private 출처 `href`가 같은 origin의 `/_private/<slug>` 형식인지 검사한다.
실제 `/_private` 문서 요청의 `401`은 reverse proxy와 배포 구성을 가진 private 인프라 계획으로 넘기고 이 저장소에서는 단정하지 않는다.
오류와 access log에도 password, session ID, 질문, 답변과 근거 본문이 없어야 한다.

### 3. image와 계약 검증

Docker image를 빌드하고 non-root 실행, health, 필수 설정 누락 실패와 graceful shutdown을 검사한다.
private 인프라 저장소가 mount할 password hash, 병합 색인, 관계 파일과 wiki root의 환경 변수 이름을 문서 계약과 대조한다.
운영 경로, host 이름, 내부 주소와 비밀값은 public image와 Git diff에 포함하지 않는다.
private 인프라 계획에는 `/_private` 비로그인 요청 `401`, 관리자 요청 성공과 rollback 검증을 입력 계약으로 전달한다.

### 4. 전체 회귀와 완료 상태

BFF test·lint·build, Quartz test·check·build, Memory Atlas browser 회귀와 public 인프라 경계 검사를 순서대로 실행한다.
제품 이름 허용과 운영 식별자 차단을 검증하는 공개 인프라 경계 shell 회귀도 다시 실행한다.
모든 검사가 통과하면 `tasks/plan10-native-auth-nestjs/index.json`의 `status`를 `completed`, `current_phases`를 `4`로 바꾼다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `services/brain-ask/test/app.e2e-spec.ts` | 실제 Nest process 인증·질문 통합 회귀 |
| `services/brain-ask/test/security.e2e-spec.ts` | cookie, origin, header와 로그 누출 검사 |
| `services/brain-ask/Dockerfile` | production image 계약 최종 확인 |
| `quartz/scripts/verify-memory-atlas.sh` | 권한 전환을 포함한 단일 browser 회귀 진입점 |
| `scripts/verify-public-infra-boundary.sh` | 운영 정보와 private fixture 누출 검사 |
| `docs/code-architecture.md` | 실제 구현과 다른 계약이 있으면 함께 교정 |
| `docs/data-schema.md` | 실제 API와 다른 계약이 있으면 함께 교정 |
| `tasks/plan10-native-auth-nestjs/index.json` | 검증 완료 상태 기록 |

## 검증

```bash
# cwd: <worktree>/services/brain-ask
corepack pnpm@10.33.0 test
corepack pnpm@10.33.0 lint
corepack pnpm@10.33.0 build
```

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm check
pnpm quartz build
scripts/verify-memory-atlas.sh
```

```bash
# cwd: <worktree>/
docker build -f services/brain-ask/Dockerfile .
bash scripts/verify-public-infra-boundary.test.sh
scripts/verify-public-infra-boundary.sh
git diff --check
```

완료 보고에는 public·admin 상태별 BFF HTTP 결과, 두 viewport browser 결과, image 실행 사용자, private href 계약과 public 누출 검사 결과를 포함한다.
운영 전환은 이 phase의 성공 commit을 private 인프라 계획에 입력한 뒤 시작하며 실제 `/_private` 접근 제어 결과는 그 계획에서 보고한다.

## 의도 메모 (왜)

- 프레임워크 단위 검사만으로는 cookie와 정적 산출물 누출을 증명할 수 없어 실제 process와 build 결과를 함께 검사한다.
- 공개 애플리케이션의 완료와 홈서버 외부 전환을 분리해 rollback 경계를 명확히 한다.
