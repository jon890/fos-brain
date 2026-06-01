# Wiki Index

이 파일은 `wiki/` 의 전체 목차다. LLM 이 Q&A·ingest·lint 시 가장 먼저 읽는 진입점.

각 항목은 `- [[페이지명]] — 한 줄 요약` 형식. 사용자는 직접 수정하지 않으며, ingest/lint skill 이 갱신한다.

## Topics

- [[topics/work-style]] — 개인 프로젝트 7개에서 일관된 개발·문서·AI 협업 방식
- [[topics/observability]] — 분산 시스템 관측성(logs·metrics·traces) 학습
- [[topics/rag-system-architecture-strategies]] — Workflow / Logic / Data Quality 3대 축으로 본 기업별 RAG 구축 전략 비교

## Concepts

### 업무 스타일

- [[concepts/ai-harness-pattern]] — 기획→구현→리뷰반영→릴리스 전 주기를 스킬로 자동화한 재사용 하네스
- [[concepts/planning-eight-step-design]] — planning 의 구현 전 8단계 설계 방법론 + ADR 자명성 게이트 (새 하네스 seed)
- [[concepts/pr-review-fix-workflow]] — review-fix 의 PR 리뷰 사후 반영 방법론 (우선순위·범위 분류·봇 루프 방지·학습 누적, seed)
- [[concepts/docs-six-axis-audit]] — docs-check 의 6축 점검 방법론 (부패·과대화·추론성·중복·자명성·가독성, seed)
- [[concepts/docs-first-adr]] — 의사결정을 코드보다 먼저 문서·ADR 로 남기는 규율
- [[concepts/commit-convention-style]] — Conventional Commits(영문 type/scope + 한국어 본문), atomic
- [[concepts/korean-readability-policy]] — 외래어 금지·마크다운 가독성 6패턴을 리뷰 점검으로 강제
- [[concepts/testing-philosophy]] — 실제 동작 검증 우선(모킹 최소·실DB·co-located)
- [[concepts/tech-stack-preferences]] — TS/Next·Java/Spring, ky·pnpm 등 고정 취향
- [[concepts/self-improving-harness]] — 리뷰 학습을 스킬 문서에 누적하는 메타 피드백 루프
- [[concepts/build-with-teams-rules]] — build-with-teams 파이프라인의 repo 무관 운영 규칙·실패 패턴 (새 하네스 seed)
- [[concepts/ai-code-review-github-actions]] — PR 자동 코드 리뷰를 GitHub Actions 로 붙이는 패턴 (marketplace action / self-hosted CLI 두 방식 + 신규 구축 레시피 + 프롬프트 설계 + 함정)

### 자동화 시스템 (ai-nodes)

- [[concepts/multi-workspace-monorepo]] — 워크스페이스 격리 + _shared 규율
- [[concepts/script-skill-separation]] — 실행(scripts)/컨텍스트(.claude/skills) 분리(ADR-006)

### 관측성·운영 (학습)

- [[concepts/observability-three-pillars]] — Logs / Metrics / Traces 역할·상호보완·한계
- [[concepts/latency-percentiles]] — p50/p95/p99, 평균의 함정, histogram_quantile
- [[concepts/red-use-metrics]] — RED(API) / USE(리소스) 메트릭 분류
- [[concepts/prometheus-histogram-vs-summary]] — 분위수 집계, 다인스턴스 합산, cardinality 함정
- [[concepts/slo-burn-rate-alerting]] — symptom 우선, multi-burn-rate 알림
- [[concepts/k8s-run-tmpfs-containerd]] — /run tmpfs 포화로 Pod 안 뜸 (containerd 메타데이터)
- [[concepts/docker-compose-config-reload]] — 마운트 config 변경이 up -d 로 반영 안 됨, force-recreate 필요 (컨테이너 운영 함정)

### RAG / 지식 시스템

- [[concepts/toss-park-ssi-rag]] — 토스 프론트엔드의 Slack 통합 RAG 봇, 순환형 지식 파이프라인
- [[concepts/docflow-code-to-doc]] — JSDoc → CI 강제 → 문서 최신성 보장. Toss RAG 의 Ingestion 측 메커니즘
- [[concepts/woowa-mulebose-text-to-sql]] — 우아한형제들의 자연어→SQL RAG, 데이터 리터러시 격차 해소
- [[concepts/multi-chain-rag-architecture]] — Router Supervisor + 의도별 특화 체인 라우팅 패턴
- [[concepts/sionic-vlm-document-parsing]] — VLM 2-Stage 파싱 + 자연어 직렬화, 파서 교체만으로 정확도 20%+ 향상

### 거시·지정학

- [[concepts/dollar-hegemony-us-china]] — 달러 패권(브레튼우즈→페트로달러→AI)과 미중 패권전쟁 프레임 (유튜브 출처)

## Entities

- [[entities/dooray-cli]] — Dooray API CLI, 하네스 원형(6스킬)
- [[entities/nhncloud-cli]] — NHN Cloud CLI, dooray-cli 하네스 포팅(코드보다 하네스 먼저)
- [[entities/fos-blog]] — Next.js 개인 블로그, 토큰 라우팅·BLG 누적
- [[entities/fos-accountbook]] — 가계부 프론트, 4계층 단방향·12스킬
- [[entities/fos-accountbook-backend]] — 가계부 Java 백엔드, 도메인 패키지·테스트 규율
- [[entities/fos-study]] — 기술 블로그 콘텐츠, 글쓰기 하네스·docs-audit
- [[entities/ocr-docs]] — OCR 공개 문서, 다국어 fan-out·공개 저장소 보안
- [[entities/ai-nodes]] — 개인 자동화 에이전트 모노레포(fos-claw), 멀티 워크스페이스

## Raw 인벤토리 요약

- `raw/web/` — Web Clipper 로 수집한 웹 기사 (현재 비어있음)
- `raw/papers/` — PDF 논문·문서 및 추출 텍스트 (1개: RAG 아키텍처 분석)
- `raw/repos/` — 코드 저장소 스니펫·README (현재 비어있음)
- `raw/notes/` — 사용자 메모·업무 기록 중 raw 로 승격된 노트 (2개: 다른 기업의 RAG 시스템 발표자료, 2026-05-28 레포 업무 스타일 분석)
- `raw/videos/` — 유튜브 자막 정리본 (1개: 자산제곱 달러 패권·미중 패권전쟁)

## 메타

- 전체 활동 연대기: [[log]] (append-only)
- 마지막 brain-add: 2026-06-01 (docu-parser 워크플로 스킬 3종 방법론 신설 — planning-eight-step-design / pr-review-fix-workflow / docs-six-axis-audit, ai-harness-pattern 보강)
- 마지막 lint: 2026-05-19
- 검색 도구: qmd (컬렉션 `brain-wiki`, `brain-raw`). 사용법은 [[../CLAUDE]] 의 "검색 도구: qmd" 섹션 참조.
