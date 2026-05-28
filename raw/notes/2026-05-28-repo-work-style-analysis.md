---
type: raw
source: 내부 레포 분석 (dooray-cli, fos-blog, fos-accountbook, fos-accountbook-backend, fos-study, nhncloud-cli, OCR-docs)
collected: 2026-05-28
method: 7개 레포 병렬 분석 에이전트
---

# 업무 스타일·하네스 레포 분석 (2026-05-28)

`~/personal` 하위 하네스 보유 레포 7개를 분석해 업무 스타일과 AI 하네스 구성을 추출한 원본 기록.
wiki 의 업무 스타일 페이지들의 출처다.

## dooray-cli

- 목적: NHN Dooray REST API 래핑 CLI (`@bifos/dooray-cli`, npm 공개, MIT). 에이전트 친화(데이터 stdout, 에러 stderr).
- 스택: TypeScript strict(ES2022), Node>=20, commander, ky(axios 금지), tsup, vitest, pnpm.
- 아키텍처: `api/ → resolvers/ → commands/ → formatters/`. 입력 통합 헬퍼(`<project> <num>`/`--id`/`--url` 흡수). `DoorayCliError(message, exitCode)`.
- 커밋: Conventional + scope, 한국어 본문. `feat(commands):`, `docs(skill):`. Issue/ADR 추적 일상화. phase 단위 세밀. Co-Authored-By: Claude.
- 코드 스타일: prettier/eslint 없이 TS strict + tsc 게이트. co-located `*.test.ts`. 타입 안전성 민감.
- 문서: `docs/`에 adr/code-architecture/data-schema/flow/prd. README 한·영 병기. ADR slim·retire 운영.
- 하네스: CLAUDE.md(451줄). 스킬 — planning(8단계), plan-and-build, build-with-teams(team-lead·critic·executor·docs-verifier), docs-check, review-fix, release(npm publish까지). `.claude/skills`(내부)와 `skills/`(공개) 분리. 커스텀 에이전트 정의.
- 특이점: 강한 프로세스 주도. PR 리뷰 학습을 skill 에 누적하는 자기개선 루프. `tasks/` 번호 디렉터리.

## fos-blog

- 목적: `jon890/fos-study` 마크다운 → MySQL 캐싱 → 렌더 개인 블로그(blog.fosworld.co.kr). 홈서버 Docker 배포.
- 스택: TS5.7 strict + Next.js 16(App Router, Turbopack), React19, Tailwind v4 + shadcn/ui, MySQL8.4 + Drizzle, unified/shiki/KaTeX/mermaid, pino, pnpm9.15, Vitest4, ESLint9.
- 아키텍처: `app/ → services/ → infra/(db,github)`, `lib/`. app 은 infra 직접 import 금지(services 경유). `posts.path` canonical, `isActive` soft-delete.
- 커밋: `type(scope): 한국어`. chore54/docs43/feat28. 리뷰 반영 gitmoji 🩹. PR번호·`plan{N}` 부착. atomic, branch prefix(tasks/feat/fix/...).
- 코드 스타일: TS strict, `@/*`, 미사용 `_` prefix. logger.child, console.log 금지. co-located test, jsdom directive.
- 문서: docs 체계(adr/code-architecture/data-schema/prd/flow). semantic line break, 6가지 가독성 + 외래어 금지 표.
- 하네스: 토큰 라우팅(계획=opus, 실행=sonnet, 검증/커밋=haiku), 전체 파일 읽기 금지, 선택은 AskUserQuestion, db:push 프로덕션 금지. 스킬 — planning, build-with-teams, plan-and-build, docs-check, review-fix, `_shared` pitfalls(BLG1~26).
- 특이점: plan{N} task → tasks/ PR → feat/ PR 분리. 리뷰 학습 BLGn 누적. 작성↔검증 분리 제도화(자기면제 금지).

## fos-accountbook (frontend)

- 목적: 가족 가계부 앱 프런트. Google/Naver OAuth, 지출·수입·통계·초대·예산알림.
- 스택: Next.js16 + React19 + TS6 strict, Tailwind v4 + shadcn/ui(new-york) + Radix + CVA, NextAuth v5, ky, RHF+Zod, recharts, pnpm10.22, Node22, Jest30 + Testing Library + MSW, ESLint9.
- 아키텍처: 4계층 단방향 `Page → Action(use server) → Service → lib/server/api`. 도메인별 평행 구조. Server Component 기본, `(authenticated)` 라우트 그룹.
- 커밋: `type(scope): 한국어`. chore111/fix63/feat48. scope=도메인 또는 plan번호. phase 단위. main 직접 push 금지.
- 코드 스타일: strict, any 금지, `@/*`. OKLCH 색 토큰 강제(hex 금지), `[data-theme="dark"]`, cn(). alert/confirm 금지→sonner. jest.mock(ADR-F09), `src/__tests__/`.
- 문서: prd/adr(F/B 번호)/data-schema/flow/code-architecture/testing-strategy. docs=AI 컨텍스트용, 코드 스니펫 금지.
- 하네스: CLAUDE.md 에 워크플로우 스킬 표 + 상황별 필수 ADR 매핑 표 + 토큰 라우팅 + 외래어 금지. 스킬 12개 — planning, plan-and-build, build-with-teams, self-healing-teams, commit-convention, review-fix, docs-check, integrate-ux, web-design-guidelines, next/vercel-react-best-practices(심볼릭).
- 특이점: ADR을 "변경-상황 매핑 표"로 운영. "phase 작업 5개 이하" 규칙(실증 근거). plan/{N} + feat/plan{N} 두 브랜치. self-healing-teams 회고 루프.

## fos-accountbook-backend

- 목적: 가계부 백엔드 REST API. JWT, 가족 그룹, 초대, 예산알림, 반복지출, 대시보드.
- 스택: Java21, Spring Boot 4.0, Gradle9 Kotlin DSL + Version Catalog, MySQL9/H2(test), Flyway, JPA + QueryDSL5.1, Security+jjwt, SpringDoc, Caffeine, p6spy, Lombok, JUnit5.
- 아키텍처: 도메인 기반 패키지(ADR-B16) + 도메인 내부 `presentation→application→domain→infra` 단방향. UUID 이중키, status Enum soft delete, `@ValidateFamilyAccess` AOP, `@TransactionalEventListener(AFTER_COMMIT)` 이벤트, domain 인터페이스 + infra 구현 분리.
- 커밋: Conventional 엄격(PR 제목도). chore55/fix29/docs15/feat12. scope=도메인/하네스/planNNN. `(closes #NN)`. Co-Authored-By.
- 코드 스타일: Checkstyle(Google, maxWarnings=0), 2 spaces, `.` 줄 시작 체이닝, 와일드카드 import 금지, 한국어 발음 식별자 금지. `@Transactional` 테스트 금지(실제 커밋 검증), Service/Repository 모킹 금지, AbstractControllerTest + fixture 빌더.
- 문서: docs=source of truth(CLAUDE.md 와 충돌 시 docs 우선). prd/flow/adr(B01~B16)/code-architecture/data-schema/testing-strategy.
- 하네스: 권한 AOP·트랜잭션 경계·Entity 직접노출 금지·Flyway 타임스탬프를 "단골 함정"으로 요약. 스킬 6 — planning, plan-and-build, build-with-teams, docs-check, integrate-api-contract, review-fix.
- 특이점: 프론트↔백 협의를 GitHub Issues로만 강제. plan/{N}+feat/plan{N}. NextAuth 테이블 camelCase / 비즈니스 snake_case. testcontainers 대신 H2, 모킹 최소화.

## fos-study

- 목적: 개인 기술 블로그 겸 학습 기록(마크다운). GitHub sync 로 fos-blog 게시. 기술 개념 / 회사 업무 작업기(`task/`) / 개인 자료 공존.
- 스택: 순수 마크다운. `.md` 경로 링크만, H1 제목 인덱싱.
- 아키텍처: 기술 도메인 폴더(architecture/database/java/devops/kafka/...) + 개인 폴더(finance/travel/resume/interview). 개념(architecture/)과 사례(task/) 엄격 분리. 영문 kebab-case 파일명.
- 커밋: Conventional + scope, 거의 `docs(scope):`. 원자적(글1·cross-link·문체수정 각각 독립). draft 명시.
- 글쓰기 스타일: 가시성 원칙(항목3+면 bullet), Bold+괄호는 `**텍스트**(영문)`만, `~`·`§` 금지, 코드블록 식별자 검증, 업무기록 일반화(Dooray→"사내 협업 도구"). Java 출신 비교 서술.
- 하네스: 스킬 — blog-post-writer(민감정보 제거), docs-audit(7축+Quality Loop, sub-agent 병렬), resume-writer. 에이전트 3 — cross-link/orphan/readme auditor.
- 특이점: AI 하네스로 글쓰기 운영. 함정을 SKILL/CLAUDE 에 즉시 반영하는 메타루프. 문체 정적 검사·일괄 수정. 정원 가꾸기식 유지보수.

## nhncloud-cli

- 목적: NHN Cloud 통합 CLI(`@bifos/nhncloud-cli` v0.1.0). 서비스별 인증·엔드포인트·봉투를 단일 profile 추상화. MVP 첫 명령 `logncrash search`.
- 스택: TS(Node>=20), Commander v14, ky(axios 금지 ADR-002), chalk/cli-table3/ora, tsup, vitest, pnpm.
- 아키텍처: `config/ → api/ → services/<svc>/ → formatters/ → commands/<svc>/`. 자격증명 `~/.nhncloud/credentials.json`(0600). profile 우선순위 `--profile`>env>config>default. 서비스별 인증 모델 차이를 봉투 helper 흡수.
- 커밋: Conventional + 한국어. 4 커밋 전부 chore/docs.
- 문서: docs 단일 소스(prd/code-architecture/data-schema/flow/adr 001~006 표 기반).
- 하네스: CLAUDE.md 가 API 검증 절차(공식 docs 단일 소스, 봇 차단 시 cmux-browser 우회) 못 박음. 스킬 7 — planning, plan-and-build(run-phases.py), build-with-teams, review-fix, docs-check, release, `_shared`. dooray-cli 하네스 포팅.
- 특이점: 하네스가 코드보다 먼저 완비(커밋2=하네스 포팅, 코드0). "도구 만들기 전 공정을 먼저 표준화". 신규 프로젝트마다 동일 하네스 복제.

## OCR-docs

- 목적: NHN Cloud OCR 공개 문서 저장소(TOAST-DOCS/OCR fork). docs.nhncloud.com 게시. Document/General OCR, Document AI.
- 스택: 순수 마크다운. gh CLI PR, dooray-cli 사내 이슈 연동, fork/upstream 동기화.
- 아키텍처: 언어 디렉터리 ko(원본)→en/ja/zh. 파일명 `{document|general}-{ocr|ai}-{api-guide|console-guide|error-code|release-notes}[-vX.Y].md`. ko=source-of-truth.
- 커밋: 두 시대 — 과거 이모지 한국어(📝🔗✏️🚨), 최근 Conventional + scope(경로). PR 머지 빈번.
- 스타일: 마크다운 서식 엄격(`*`→`-`, 테이블 폭 다국어 일관, 절대→상대 링크). zh=영문, ja=번역.
- 하네스: CLAUDE.md(gitignore, 로컬 전용) — 공개 저장소 보안(Dooray 링크·사내 번호·멤버ID·사내 URL 금지, placeholder만). 스킬 4 — api-guide, docs-i18n-sync(ko→en/ja/zh), dooray-task-to-docs-update(사내 이슈→공개 PR), sync-upstream.
- 특이점: 커밋 이모지→Conventional 마이그레이션 중. fork 모델(alpha/beta/release/master). 보안 경계를 하네스에서 강제. scope 에 경로, source→fan-out 번역, 이슈→PR 스킬화.
