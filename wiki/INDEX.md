# Wiki Index

이 파일은 `wiki/` 의 전체 목차다. LLM 이 Q&A·brain-add·lint 시 가장 먼저 읽는 진입점.

각 항목은 `- [[페이지명]] — 한 줄 요약` 형식. 사용자는 직접 수정하지 않으며, brain-add/lint skill 이 갱신한다.

## Topics

- [[work-style]] — 개인 프로젝트 7개에서 일관된 개발·문서·AI 협업 방식
- [[ai-dev-harness]] — 기획~릴리스 전 주기를 AI 에이전트로 자동화하는 하네스 방식 (work-style 의 한 축)
- [[observability]] — 분산 시스템 관측성(logs·metrics·traces) 학습
- [[operations-troubleshooting]] — 운영 중 실제로 터진 인프라·컨테이너 장애와 해결 사례
- [[rag-system-architecture-strategies]] — Workflow / Logic / Data Quality 3대 축으로 본 기업별 RAG 구축 전략 비교
- [[ai-era-professionalism]] — AI 시대 전문성이 생산 숙련에서 검증·판단·운영 책임으로 이동하는 변화

## Concepts

### AI 개발 하네스

상위 주제: [[ai-dev-harness]]

- [[ai-harness-pattern]] — 기획→구현→리뷰반영→릴리스 전 주기를 스킬로 자동화한 재사용 하네스 (핵심 허브)
- [[harness-bootstrap-checklist]] — 새 레포에 하네스를 까는 조립 순서 체크리스트 (메모리→스킬→전용 agent→pitfalls→docs→CI→자기개선)
- [[planning-eight-step-design]] — planning 의 구현 전 8단계 설계 방법론, ADR 자명성 점검 (새 하네스 seed)
- [[shared-skill-core-overlay]] — 복제 스킬을 단일 코어와 레포 오버레이로 나눠 개선을 한 곳에서만 반영 (전역 override 함정 포함)
- [[skill-section-single-ownership]] — 스킬 문서 안 같은 지시가 여러 섹션에 중복되면 한 섹션만 소유자로 남기는 원칙
- [[skill-versioning-changelog]] — 심링크로 배포되는 공용 스킬의 버전+CHANGELOG 체계 (버전은 배포 핀이 아님)
- [[build-with-teams-rules]] — build-with-teams 파이프라인의 repo 무관 운영 규칙·실패 패턴 (새 하네스 seed)
- [[execution-log-vs-retrospective]] — 실행 기록(매번 얕게)과 회고(사건마다 깊게)의 역할 분리
- [[subagent-delegation-report-everything]] — subagent 에게 "걸러서 보고하라" 지시하지 않고 위임한 쪽이 필터링하는 원칙
- [[custom-domain-agent]] — 일반 역할 agent 를 레포 도메인 지식으로 특화한 전용 subagent (executor·docs-verifier, self-check grep 내장)
- [[pr-review-fix-workflow]] — review-fix 의 PR 리뷰 사후 반영 방법론 (우선순위·범위 분류·봇 루프 방지·학습 누적, seed)
- [[docs-six-axis-audit]] — docs-check 의 6축 점검 방법론 (부패·과대화·추론성·중복·자명성·가독성, seed)
- [[merge-conflict-free-append]] — 누적 append 파일의 머지 충돌을 파일 per 항목, INDEX 라우터로 구조적 제거 (번호 glob 으로 발견성 보존, pitfalls→ADR 이식)
- [[pitfalls-file-per-pattern]] — 회피 패턴 wiki 를 파일-per-패턴, INDEX 라우터로 운영 (카테고리=소비 시점, 축적 점검, prune·automate)
- [[agent-friendly-cli-design]] — 사람·AI 에이전트가 함께 쓰는 CLI 의 입력·출력·에러 설계 패턴 (dooray-cli→nhncloud-cli)
- [[self-improving-harness]] — 리뷰 학습을 스킬 문서에 누적하는 메타 피드백 루프
- [[gnosis-agent-autonomous-growth]] — LLM 가중치가 아니라 외부 기억·스킬·가치 레이어를 갱신하는 성장형 에이전트 프레임워크
- [[agent-autonomy-growth-levels]] — AI 에이전트 자율성을 L0 단순 응답부터 L5 헌법 수준 자기 수정까지 나누는 단계 모델
- [[constitutional-growth-gate]] — 성장형 에이전트 업데이트를 적용하기 전 constitution 위반 여부를 검사하는 강제 점검 장치
- [[ai-code-review-github-actions]] — PR 자동 코드 리뷰를 GitHub Actions 로 붙이는 패턴 (marketplace action / self-hosted CLI 두 방식, 신규 구축 레시피, 프롬프트 설계, 함정)
- [[ai-generated-code-acceptance-criteria]] — AI 생성 코드가 동작해도 사람이 설명 가능성과 변경 규모를 기준으로 채택 여부를 판단하는 기준
- [[claude-code-memory-rules]] — Claude Code 메모리: CLAUDE.md·.claude/rules 자동 로드 규칙(frontmatter·paths·우선순위), 규칙을 여러 레포에 재사용하는 법, 강제는 hook
- [[pr-body-convention]] — PR 본문 공통 양식(Summary/Changes/Verification, Commits·프로세스이력 제외, 자가점검), .claude/rules 적용법

### 스킬 자동 최적화

- [[skillopt-trainable-skill-document]] — 스킬 문서를 신경망 가중치처럼 학습(Microsoft SkillOpt), Sleep 야간 정리
- [[skill-auto-optimization-prerequisites]] — reward·held-out 선행 조건, A/B/C 채점 계층
- [[skill-self-scoring-two-axis]] — 스킬 자체 품질을 기계축(score.sh)과 판단축(rubric.md, 자기채점 금지)으로 나눠 채점
- [[reward-detector-false-positive]] — reward detector 오탐을 먼저 잡기(잘못된 그래디언트 방어)
- [[two-tier-reward-static-llm-judge]] — 정적 정규식 바닥, LLM judge 천장 2계층 reward

### AI 네이티브 작업 방식

- [[codex-general-work-agent]] — Codex를 코드 생성기보다 넓은 데이터 분석·리서치·협업 도구 탐색 업무 에이전트로 쓰는 패턴
- [[ai-native-startup-strategy]] — 기반 모델 시대에 스타트업이 고객 워크플로우와 미래 모델 능력으로 방어력을 만드는 전략
- [[ai-era-tinkerer-talent]] — AI 도구를 자주 실험하는 팅커러 태도와 기초 체력을 함께 가진 인재상
- [[ax-j-curve-trap]] — AX 도입 뒤 환호와 사용량 증가를 지나 검증·부채·파이프라인 재설계의 구덩이를 통과하는 단계 모델
- [[ai-era-debt-triad]] — AI 시대에 기술부채·인지부채·의도부채가 결합해 조직 속도와 신뢰를 갉아먹는 구조
- [[ai-verification-layer]] — AI 산출물을 전부 이해하려 하기보다 통과 기준과 자동 검증 구조로 신뢰를 만드는 방식
- [[ai-native-company]] — 회사 지식과 업무 시스템을 AI가 검색·참조·반복 개선할 수 있게 재편한 조직
- [[ai-era-professional-operator]] — 전문가가 산출물 숙련자에서 자기 도메인의 AI 운영 책임자로 바뀌는 인재상

### 개인 코딩 규율·취향

- [[docs-first-adr]] — 의사결정을 코드보다 먼저 문서·ADR 로 남기는 규율
- [[commit-convention-style]] — Conventional Commits(영문 type/scope, 한국어 본문), atomic
- [[testing-philosophy]] — 실제 동작 검증 우선(모킹 최소·실DB·co-located)
- [[tech-stack-preferences]] — TS/Next·Java/Spring, ky·pnpm 등 고정 취향

### 학습 방법

- [[self-directed-learning]] — 읽기·토론·글쓰기·피드백으로 스스로 배우는 능력을 기르는 학습 프레임

### 면접 준비

- [[executive-personality-interview-risk-frame]] — 임원·인성면접을 조직 리스크 관리 관점에서 준비하는 프레임

### 자동화 시스템 (ai-nodes)

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

### 운영·트러블슈팅 (실전)

상위 주제: [[operations-troubleshooting]]

- [[k8s-run-tmpfs-containerd]] — /run tmpfs 포화로 Pod 안 뜸 (containerd 메타데이터)
- [[ingress-controller-internal-external-split]] — 외부/내부 ingress controller 분리, cluster-scoped webhook self-lock 함정
- [[docker-compose-config-reload]] — 마운트 config 변경이 up -d 로 반영 안 됨, force-recreate 필요 (컨테이너 운영 함정)

### RAG / 지식 시스템

- [[toss-park-ssi-rag]] — 토스 프론트엔드의 Slack 통합 RAG 봇, 순환형 지식 파이프라인
- [[docflow-code-to-doc]] — JSDoc → CI 강제 → 문서 최신성 보장. Toss RAG 의 Ingestion 측 메커니즘
- [[woowa-mulebose-text-to-sql]] — 우아한형제들의 자연어→SQL RAG, 데이터 리터러시 격차 해소
- [[multi-chain-rag-architecture]] — Router Supervisor, 의도별 특화 체인 라우팅 패턴
- [[sionic-vlm-document-parsing]] — VLM 2-Stage 파싱, 자연어 직렬화, 파서 교체만으로 정확도 20%+ 향상

### 거시·지정학

- [[dollar-hegemony-us-china]] — 달러 패권(브레튼우즈→페트로달러→AI)과 미중 패권전쟁 프레임 (유튜브 출처)

### 생활·요리

- [[simple-store-bought-naengmyeon]] — 시판 냉면사리와 시판 육수로 물냉면을 만들 때의 준비·면 삶기·간 맞추기

### 일반 엔지니어링 교훈 (실전)

- [[pydantic-invalid-kwarg-silent-ignore]] — Pydantic 무효 kwarg 는 조용히 버려진다 (옵션 적용은 결과 객체로 검증)
- [[review-bot-suggestion-verify]] — 리뷰 봇 제안의 명령·정규식은 실측 없이 적용하면 검증을 조용히 무력화한다
- [[vendor-bug-wrapper-vs-replace]] — vendor 라이브러리 버그, 상속 wrapper 우회 vs 라이브러리 교체 판단 기준
- [[removal-plan-grep-gate]] — 제거 작업의 grep 통과 조건 함정과 docs 부패
- [[append-only-doc-file-per-item-split]] — append-only 단일 문서를 파일-per-항목, INDEX 라우터로 분리
- [[helm-null-annotation-render]] — Helm 공통 values 의 annotation 을 환경별로 제거할 때 null 처리 함정
- [[jenkins-logrotator-daystokeep-numtokeep]] — Jenkins LogRotator daysToKeep(일수)·numToKeep(개수) 오해로 디스크 축적
- [[pid1-zombie-tini]] — 컨테이너 PID 1 좀비 reaping 과 tini 도입
- [[prometheus-multiproc-histogram]] — Prometheus 멀티프로세스 Histogram 은 메인 프로세스에서 lazy create 안 됨
- [[torch-cuda-multiprocess-vram]] — torch.cuda 메모리 메트릭은 멀티프로세스 워커의 실제 VRAM 을 못 본다 (DCGM 이 정확)
- [[hwp-v5-extended-record]] — HWP v5 확장 레코드(0xFFF) 미처리로 인한 장문 단락 파싱 실패

## Entities

- [[dooray-cli]] — Dooray API CLI, 하네스 원형(6스킬)
- [[nhncloud-cli]] — NHN Cloud CLI, dooray-cli 하네스 포팅(코드보다 하네스 먼저)
- [[fos-blog]] — Next.js 개인 블로그, 토큰 라우팅·BLG 누적
- [[fos-accountbook]] — 가계부 프론트, 4계층 단방향·12스킬
- [[fos-accountbook-backend]] — 가계부 Java 백엔드, 도메인 패키지·테스트 규율
- [[fos-study]] — 기술 블로그 콘텐츠, 글쓰기 하네스·docs-audit
- [[ai-nodes]] — 개인 자동화 에이전트 모노레포(fos-claw), 멀티 워크스페이스
- [[coding-engineer-tv]] — 유튜버 코딩하는기술사(@codingpe), 성능·아키텍처 자료 추적 허브
- [[career-strategy-youtube]] — 유튜버 취업전략:통념을 파괴하는 합격자의 관점, 면접·취업 전략 자료 추적 허브
- [[jocoding-youtube]] — 유튜버 조코딩 JoCoding, AI·개발·창업·기술 인터뷰 자료 추적 허브

## Raw 인벤토리 요약

- `raw/web/` — Web Clipper 로 수집한 웹 기사 (2개: 문서 파싱 품질 평가, AI 생성 코드 채택 기준)
- `raw/papers/` — PDF 논문·문서 및 추출 텍스트 (2개: RAG 아키텍처 분석, AI 시대 전문성)
- `raw/repos/` — 코드 저장소 스니펫·README (현재 비어있음)
- `raw/notes/` — 사용자 메모·업무 기록 중 raw 로 승격된 노트 (주요: RAG 발표자료, 레포 업무 스타일 분석, build-with-teams 규칙, docu-parser 워크플로 스킬, ADR 디렉터리 분해, SkillOpt 세션, 2026-06-12 docu-parser 하네스 발전분)
- `raw/videos/` — 유튜브 자막 정리본 (5개: 자산제곱 달러 패권·미중 패권전쟁, NAVER D2 GNOSIS 에이전트 자율 성장, 코딩하는기술사 커넥션 풀, 취업전략 임원 면접, 조코딩 OpenAI AGI·Codex 인터뷰)

## 메타

- 전체 활동 연대기: [[log]] (append-only)
- 마지막 brain-add: 2026-07-30 (fos-skills 하네스 진화 — 신규 5, 보강 4)
- 마지막 lint: 2026-07-01
- 검색 도구: qmd (컬렉션 `brain-wiki`, `brain-raw`). 사용법은 CLAUDE.md 의 "검색 도구: qmd" 섹션 참조.
