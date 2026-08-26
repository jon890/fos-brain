# Wiki Index

이 파일은 `wiki/` 의 전체 목차다. LLM 이 Q&A·brain-add·lint 시 가장 먼저 읽는 진입점.

각 항목은 `- [[페이지명]] — 한 줄 요약` 형식. 사용자는 직접 수정하지 않으며, brain-add/lint skill 이 갱신한다.

## Topics

- [[work-style]] — 개인 프로젝트에서 반복되는 개발·문서·검증과 AI 협업 방식
- [[ai-dev-harness]] — 목표, 권한과 검증 경계 안에서 에이전트 작업을 완료하는 하네스 방식
- [[observability]] — 분산 시스템 관측성(logs·metrics·traces) 학습
- [[operations-troubleshooting]] — 증상과 실제 상태를 분리하고 최소 변경과 되돌리기 근거로 복구하는 운영 방식
- [[rag-system-architecture-strategies]] — 입력 품질, 검색 파이프라인과 관계 탐색을 나누는 RAG 설계 관점
- [[ai-era-professionalism]] — AI 시대 전문성을 검증·판단·운영 책임으로 보는 개인 직업 관점

## Concepts

### AI 개발 하네스

상위 주제: [[ai-dev-harness]]

- [[ai-harness-pattern]] — 기획→구현→리뷰반영→릴리스 전 주기를 스킬로 자동화한 재사용 하네스 (핵심 허브)
- [[shared-skill-core-overlay]] — 복제 스킬을 단일 코어와 레포 오버레이로 나눠 개선을 한 곳에서만 반영 (전역 override 함정 포함)
- [[skill-section-single-ownership]] — 스킬 문서 안 같은 지시가 여러 섹션에 중복되면 한 섹션만 소유자로 남기는 원칙
- [[skill-versioning-changelog]] — 심링크로 배포되는 공용 스킬의 버전+CHANGELOG 체계 (버전은 배포 핀이 아님)
- [[execution-log-vs-retrospective]] — 실행 기록(매번 얕게)과 회고(사건마다 깊게)의 역할 분리
- [[merge-conflict-free-append]] — 누적 append 파일의 머지 충돌을 파일 per 항목, INDEX 라우터로 구조적 제거 (번호 glob 으로 발견성 보존, pitfalls→ADR 이식)
- [[pitfalls-file-per-pattern]] — 회피 패턴 wiki 를 파일-per-패턴, INDEX 라우터로 운영 (카테고리=소비 시점, 축적 점검, prune·automate)
- [[agent-friendly-cli-design]] — 사람·AI 에이전트가 함께 쓰는 CLI 의 입력·출력·에러 설계 패턴 (dooray-cli→nhncloud-cli)
- [[self-improving-harness]] — 리뷰 학습을 스킬 문서에 누적하는 메타 피드백 루프
- [[ai-code-review-github-actions]] — PR 자동 코드 리뷰를 GitHub Actions 로 붙이는 패턴 (marketplace action / self-hosted CLI 두 방식, 신규 구축 레시피, 프롬프트 설계, 함정)
- [[ai-generated-code-acceptance-criteria]] — AI 생성 코드가 동작해도 사람이 설명 가능성과 변경 규모를 기준으로 채택 여부를 판단하는 기준

### 스킬 자동 최적화

- [[skillopt-trainable-skill-document]] — 스킬 문서를 신경망 가중치처럼 학습(Microsoft SkillOpt), Sleep 야간 정리
- [[skill-auto-optimization-prerequisites]] — reward·held-out 선행 조건, A/B/C 채점 계층
- [[skill-self-scoring-two-axis]] — 스킬 자체 품질을 기계축(score.sh)과 판단축(rubric.md, 자기채점 금지)으로 나눠 채점
- [[reward-detector-false-positive]] — reward detector 오탐을 먼저 잡기(잘못된 그래디언트 방어)
- [[two-tier-reward-static-llm-judge]] — 정적 정규식 바닥, LLM judge 천장 2계층 reward

### AI 검증

- [[ai-verification-layer]] — AI 산출물을 전부 이해하려 하기보다 통과 기준과 자동 검증 구조로 신뢰를 만드는 방식

### 개인 코딩 규율·취향

- [[docs-first-adr]] — 의사결정을 코드보다 먼저 문서·ADR 로 남기는 규율
- [[testing-philosophy]] — 실제 동작 검증 우선(모킹 최소·실DB·co-located)
- [[tech-stack-preferences]] — TS/Next·Java/Spring, ky·pnpm 등 고정 취향
- [[information-interface-preferences]] — 훑기와 비교, 모바일 다이어그램의 확대·이동, 원문 탐색을 연결하는 정보 화면 취향

### 학습 방법

- [[self-directed-learning]] — 읽기·토론·글쓰기·피드백으로 스스로 배우는 능력을 기르는 학습 프레임

### 면접 준비

- [[executive-personality-interview-risk-frame]] — 임원·인성면접을 조직 리스크 관리 관점에서 준비하는 프레임

### 자동화 시스템 (fos-agents)

- [[multi-workspace-monorepo]] — 워크스페이스 격리, _shared 규율
- [[script-skill-separation]] — 실행(scripts)/컨텍스트(.claude/skills) 분리(ADR-006)

### 관측성 (학습)

- [[observability-three-pillars]] — Logs / Metrics / Traces 역할·상호보완·한계
- [[latency-percentiles]] — p50/p95/p99, 평균의 함정, histogram_quantile
- [[red-use-metrics]] — RED(API) / USE(리소스) 메트릭 분류
- [[prometheus-histogram-vs-summary]] — 분위수 집계, 다인스턴스 합산, cardinality 함정
- [[slo-burn-rate-alerting]] — symptom 우선, multi-burn-rate 알림

### 성능·확장성 (학습)

- [[connection-pool-sizing]] — DB 커넥션 풀 사이즈 공식(코어×2+스핀들), USL 역설, Little's Law 진단, WAS 분배, maxconn 한계
- [[connection-pool-pitfalls]] — 커넥션 풀 4대 함정(롱 트랜잭션·maxLifetime 미스매치·CM>1 데드락·누수)

### 품질 평가 (학습)

- [[document-parsing-quality-evaluation]] — 문서 파싱 품질 평가 방법론 스펙트럼(회귀→golden→NED→docling-eval→LLM-judge), 비용·깊이로 조합

### RAG와 검색 (학습)

상위 주제: [[rag-system-architecture-strategies]]

- [[rag-retrieval-pipeline]] — 질문 구조화, 하이브리드 검색, 재정렬과 근거 전달을 잇는 공통 검색 흐름
- [[embedding-versioned-vector-index]] — 임베딩 모델 변경을 벡터 재생성, 재색인과 서빙 전환까지 묶는 운영 원칙
- [[graph-rag-path-retrieval]] — 질문에 맞는 시작 노드와 제한된 관계 경로로 설명 가능한 서브그래프를 찾는 방식

### 생활·요리

- [[simple-store-bought-naengmyeon]] — 시판 냉면사리와 시판 육수로 물냉면을 만들 때의 준비·면 삶기·간 맞추기

### 일반 엔지니어링 교훈

- [[review-bot-suggestion-verify]] — 리뷰 봇 제안의 명령·정규식은 실측 없이 적용하면 검증을 조용히 무력화한다
- [[vendor-bug-wrapper-vs-replace]] — vendor 라이브러리 버그, 상속 wrapper 우회 vs 라이브러리 교체 판단 기준
- [[removal-plan-grep-gate]] — 제거 작업의 grep 통과 조건 함정과 docs 부패
- [[append-only-doc-file-per-item-split]] — append-only 단일 문서를 파일-per-항목, INDEX 라우터로 분리
- [[pid1-zombie-tini]] — 컨테이너 PID 1 좀비 reaping 과 tini 도입

## Entities

- [[dooray-cli]] — Dooray API CLI, 하네스 원형(6스킬)
- [[nhncloud-cli]] — NHN Cloud CLI, dooray-cli 하네스 포팅(코드보다 하네스 먼저)
- [[fos-blog]] — Next.js 개인 블로그, 토큰 라우팅·BLG 누적
- [[fos-accountbook]] — 가족용 가계부 웹 제품과 안전한 금융 화면 입력 자동화
- [[fos-accountbook-backend]] — 가계부 Java 백엔드, 도메인 패키지·테스트 규율
- [[fos-study]] — 기술 블로그 콘텐츠, 글쓰기 하네스·docs-audit
- [[fos-agents]] — 개인 업무와 생활 자동화를 독립 워크스페이스로 관리하는 모노레포

## Raw 인벤토리 요약

- `raw/web/` — Web Clipper 로 수집한 웹 기사 (2개: 문서 파싱 품질 평가, AI 생성 코드 채택 기준)
- `raw/papers/` — PDF 논문·문서 및 추출 텍스트 (2개: RAG 아키텍처 분석, AI 시대 전문성)
- `raw/repos/` — 코드 저장소 스니펫·README (현재 비어있음)
- `raw/notes/` — 사용자 메모와 승인된 세션 요약 중 raw 로 승격된 노트
- `raw/videos/` — 유튜브 자막 정리본 (6개: 자산제곱 달러 패권·미중 패권전쟁, NAVER D2 GNOSIS 에이전트 자율 성장, 코딩하는기술사 커넥션 풀, 취업전략 임원 면접, 조코딩 OpenAI AGI·Codex 인터뷰, 토스증권 추천·검색 테크톡)

## 메타

- 전체 활동 연대기: [[log]] (append-only)
- 마지막 brain-add: 2026-08-26 (토스증권 추천·검색 테크톡 — 신규 3, 보강 1)
- 마지막 lint: 2026-07-01
- 검색 도구: qmd (컬렉션 `brain-wiki`, `brain-raw`). 사용법은 CLAUDE.md 의 "검색 도구: qmd" 섹션 참조.
