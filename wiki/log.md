# Wiki Log

Append-only 연대기. ingest·query·lint skill 이 매번 한 줄 append 한다. 사용자도 LLM 도 기존 항목을 수정·삭제하지 않는다. `grep '## \[2026-05' log.md` 같은 검색으로 진화 타임라인을 추적할 수 있다.

형식: `## [YYYY-MM-DD] {ingest|query|lint} | <한 줄 설명>` 다음 줄에 세부 메모.

---

## [2026-06-25] lint | 구조 무결성 점수 0점 감점으로 복구
- 검사: brain_score 구조 8축 / 결과: visibility leak 0, broken backlink 0, path wikilink 0, missing Sources 0, frontmatter 0, index desync 0, orphan 0, style tilde 0
- 수정: public→work 전용 wikilink 제거, 경로형 wikilink 2건 제거, docker-compose-config-reload Sources 보강
- 도구 보정: `brain_score.py` 의 Sources 판정을 wikilink 필수에서 비어 있지 않은 Sources 섹션으로 변경해 외부 repo·실측 로그 출처 오탐을 제거

## [2026-06-16] ingest | ai-code-review-github-actions 보강 — read-only 인라인 라인 계산 + 오탐/큰diff 함정
- Source: fos-blog `.github/workflows/code-review-prompt.txt` 단일 opus 전환 작업 + 독립 평가에서 도출한 일반화 학습
- 신규 1 섹션: "인라인 라인 계산 — read-only 리뷰봇의 함정" (hunk 헤더 누적 계산법·422 는 entry 만 빼고 재시도·실패해도 요약 게시)
- 함정 3 bullet: 큰 diff false negative(규모 판단 후 전수 못 하면 명시), 구체 체크리스트의 오탐 역효과(read-only↔구체성 trade-off), 빈 배열 API 차단 > 자연어 sanity
- 범위: repo 무관 일반 방법론만. fos-blog 프롬프트 전문·도메인 특화 항목은 repo 에 두고 미등록

## [2026-06-12] ingest | docu-parser 하네스 발전분 환원 — 기존 하네스 5개념 보강
- Source: raw/notes/2026-06-12-docu-parser-harness-evolution.md (한 프로젝트 하네스가 plan 43개 진행하며 발전한 분석 중 기존 concept 보강분, repo 무관 일반화)
- 보강 5 concept: build-with-teams-rules(스폰 안전·재시도 한도·spawn-shutdown·특이사항 4종·마킹 사고 역검증), self-improving-harness(역할별 회고 거울 구조·회피 패턴 wiki 운영 규율), ai-harness-pattern(커스텀 도메인 에이전트=단일 소스), planning-eight-step-design(번호 충돌 방지·docs↔코드 식별자 정합), merge-conflict-free-append(축적 점검·prune 운영 규율 한 줄 연결)
- 운영 개념(격리 검증·카나리 rolling·에러 분류)은 사용자 결정으로 brain 신설 보류 — 보강분만 반영
- 맥락: 2026-06-01 노트는 planning/review-fix/docs-check 3스킬만 추출 → 그 후 발전한 (1)자기개선 인프라 (2)평가자 다단 파이프라인 보강분을 환원. docu-parser 구체(인스턴스명·도메인·사내 식별자)는 전부 제거

## [2026-06-12] lint | public 연결·stale 점검 — 건강 확인, 실질 수정 0
- 검사: 구조 10항 + stale 품질축 / 발견: 실질 0 (brain_score -53 은 대부분 오탐)
- 연결: 깨진 백링크 0, 고아 0, 경로형 0(raw Sources 면제), 누출 0 (work-style 은 public topics 인데 score 가 work/ slug 로 오인)
- stale: 하네스 concept 다 최근·역할 분명 → prune 불필요. openclaw 는 이미 topics/openclaw + INDEX 카테고리로 분리 완료(비대 오판)
- 미수정(면제): docker-compose-config-reload Sources(실측 함정 ADR류), frontmatter 1(미미), style_tilde 1(범위표기·홈경로 오탐)

## [2026-06-12] ingest | 누적 파일 머지 충돌 구조 제거 패턴 신규 + planning phase/docs 함정 보강
- Source: raw/notes/2026-06-12-adr-directory-split.md
- 신규 1 페이지: concept(merge-conflict-free-append) — append 파일 충돌을 파일 per 항목 + INDEX 라우터로 제거, 번호 glob 으로 발견성 보존
- 보강 2 페이지: planning-eight-step-design (phase = 코드 작업 only 섹션에 "결정 docs 는 planning 책임, phase 아님" 함정), ai-harness-pattern (백링크)
- 맥락: docu-parser plan043 — adr.md 단일 파일이 PR 마다 끝줄 충돌(PR #166 ADR-028 vs 029) → pitfalls 의 파일 per 패턴 구조를 ADR 로 이식

## [2026-06-02] lint | marketplace action 의 prompt 주입 방식 delta 보강
- 보강 1 페이지: ai-code-review-github-actions (프롬프트 주입 — marketplace action vs self-hosted CLI delta 소절 신설)
- 맥락: nhncloud-cli claude-code-review.yml 정비 — marketplace action 에서도 prompt .txt 외부 분리가 가능하나 주입 경로가 self-hosted CLI 와 다름. action 은 사전 step 의 envsubst 출력을 $GITHUB_OUTPUT 멀티라인 output 으로 담아 prompt 입력에 전달, CLI 는 stdin 파이프
- 함정 추가: $GITHUB_OUTPUT heredoc delimiter 가 프롬프트 본문에 등장하면 output 잘림
- 기존 페이지의 개방형 프레이밍·opus 별칭 권고를 nhncloud-cli 가 실제 적용한 사례로 Sources 갱신

## [2026-05-29] ingest | claude code review self-hosted CLI 방식 + 신규 구축 레시피
- Source: raw/notes/2026-05-29-claude-code-review-cli-recipe.md
- 보강 1 페이지: ai-code-review-github-actions (marketplace action 중심 → CLI 방식·신규 레시피·프롬프트 설계·함정 추가)
- 맥락: docu-parser claude-review.yml 정비 — 개방형 프레이밍(앵커링 방지), 프롬프트 .txt 분리(markdown linter glob 손상), opus 별칭(버전 추종), 조용한 실패 가시화, Checks API GitHub App 전용
- GHE 특화 delta 는 work/nhn(ghe-claude-review-ops)로 분리

## [2026-05-29] ingest | docker compose 마운트 config reload 함정 (force-recreate)
- Source: docu-parser Vector 사이드카 로그 유실 디버깅 세션 (work/nhn 사례에서 범용 부분 추출)
- 신규 1 concept: docker-compose-config-reload. 마운트된 config 파일 내용 변경은 up -d 의 recreate 트리거가 아니라 옛 컨테이너가 유지된다 → --force-recreate 필요. k8s 는 rollout restart 로 유사 패턴(참고).
- work→public link: work/nhn entities/ai-playground-docu-parser, concepts/nhn-log-and-crash 에서 이 페이지로 연결.

## [2026-05-19] ingest | RAG 시스템 사례 비교 (Toss, 우아한형제들, Sionic AI)
- Sources: `raw/papers/RAG_아키텍처_분석_토스_우아한형제들_Sionic_AI_전략_비교.pdf` (15p), `raw/notes/다른 기업의 RAG 시스템 발표자료.md`
- 신규 5 concept + 1 topic. INDEX 신규 등록.

## [2026-05-19] query | 토스·우아한형제들·Sionic 의 핵심 차이는?
- 답변 근거: `topics/rag-system-architecture-strategies`. raw 하강 불필요.
- 환원: topic 페이지 상단에 "한 줄 요약" 슬로건 섹션 추가.

## [2026-05-19] lint | 첫 무결성 점검
- 7개 항목 검사, 1건 수정 (topic frontmatter `updated` 괄호 코멘트 제거).

## [2026-05-19] system | Karpathy gist 보강 — 우선순위 1–3 (높음) 적용
- `wiki/log.md` 신설 (append-only 연대기).
- lint 검사 항목 #8 모순 감지, #9 누락 교차 참조 추가 (총 9개).
- ingest skill cross-reference 적극성 강화, 3개 skill 모두 log.md append 의무화.

## [2026-05-19] lint | 9개 항목 재검사 (신규 #8, #9 검증)
- 발견 0건, 수정 0건. 신규 항목 정상 동작 확인.

## [2026-05-19] system | Karpathy gist 보강 — 우선순위 4–7 (중간·낮음) 적용
- vault CLAUDE.md 에 "검색 도구: qmd", "Obsidian 운영 가이드", "Future Work" 섹션 추가.
- qmd 2.1.0 설치 (bun install -g @tobilu/qmd). 컬렉션 `obsidian-wiki`, `obsidian-raw` 등록, 임베딩 9 chunks 생성.
- query skill 의 1차 검색을 `qmd query` 로 전환 (페이지 > 20 또는 의미적 질문).
- ingest skill 에 `qmd update && qmd embed` 인덱스 갱신 단계 추가.
- lint skill 에 `qmd status` 사전 점검 단계 추가.
- 합성 데이터·파인튜닝·자체 UI·Marp 자동화는 Future Work 로 명시.

## [2026-05-28] add | 7개 레포 업무 스타일·AI 하네스 등록 (public)
- Source: `raw/notes/2026-05-28-repo-work-style-analysis.md`
- 신규 16 페이지: topic 1(work-style), concept 7(ai-harness-pattern, docs-first-adr, commit-convention-style, korean-readability-policy, testing-philosophy, tech-stack-preferences, self-improving-harness), entity 7(dooray-cli, nhncloud-cli, fos-blog, fos-accountbook, fos-accountbook-backend, fos-study, ocr-docs)
- 대상 레포: dooray-cli, fos-blog, fos-accountbook(+backend), fos-study, nhncloud-cli, OCR-docs

## [2026-05-28] add | build-with-teams 하네스 일반 규칙 (public)
- Source: `raw/notes/2026-05-28-build-with-teams-harness-rules.md` (nhncloud-cli plan001 실행 회고)
- 신규 1 페이지: concept(build-with-teams-rules). 보강 2: ai-harness-pattern, self-improving-harness 백링크.
- repo 무관 하네스 운영 규칙·실패 패턴만 추림 (프로젝트별 코딩 규칙 제외). 새 하네스 seed 용.

## [2026-05-28] add | fos-study 관측성 클러스터 (observability + k8s /run tmpfs)
- Source: fos-study `architecture/observability-basics.md`, `devops/k8s/gpu-node-run-tmpfs-full.md` (외부 repo, 경로 인용)
- 신규 7 페이지: topic 1(observability), concept 6(observability-three-pillars, latency-percentiles, red-use-metrics, prometheus-histogram-vs-summary, slo-burn-rate-alerting, k8s-run-tmpfs-containerd)
- 게이트: gpu-tmpfs 는 fos-study(blog-post-writer 검증 완료)가 출처라 public 으로. 코드 스니펫·체크리스트는 제외(원본 참조).

## [2026-05-28] add | fos-claw(ai-nodes) 자동화 시스템 아키텍처
- Source: github.com/jon890/fos-claw AGENTS.md/README.md (public repo, 경로 인용)
- 신규 4 페이지: entity(ai-nodes) + concept 3(multi-workspace-monorepo, script-skill-separation, task-run-tracking)
- 범위: 아키텍처·패턴만(개인 워크스페이스 데이터 제외). work-style 하네스 클러스터와 cross-link.

## [2026-05-28] add | GitHub Actions AI 코드 리뷰 워크플로우 패턴
- Source: github.com/jon890/nhncloud-cli .github/workflows/claude-code-review.yml (public repo, 경로 인용)
- 신규 1 페이지: concept(ai-code-review-github-actions), 보강 1(ai-harness-pattern 백링크)
- 범위: 재사용 방법론·함정만(트리거·리뷰어 구성 트레이드오프·게시·gotcha). nhncloud 고유 인증/API 사실 제외.

## [2026-05-28] add | 유튜브 — 달러 패권·미중 패권전쟁 (자산제곱)
- Source: raw/videos/2026-05-12-dollar-hegemony-jasanjegop.md (YouTube ko 자동자막)
- 신규 1 페이지: concept(dollar-hegemony-us-china). 거시·지정학 그룹 신설.
- 자동자막 기반(오인식 가능)·단일 채널 관점 표기. public 객관 요약.

## [2026-05-29] delete | task-run-tracking 개념 제거 (track_task.sh 폐기 반영)
- 대상: wiki/concepts/task-run-tracking.md (방식: 완전 삭제)
- 정리: 백링크 2건 제거(multi-workspace-monorepo, entities/ai-nodes), INDEX 항목 제거
- 사유: ai-nodes ADR-011로 track_task.sh·extract_claude_result.ts·update_artifacts.py 폐기. 5 워크스페이스 native 직접 호출 전환으로 공통 실행 래퍼 개념 자체가 stale.
- raw: 없음 (Sources는 fos-claw AGENTS.md 경로 인용, raw 파일 미인용)

## [2026-06-01] add | docu-parser 워크플로 스킬 3종 방법론
- Source: raw/notes/2026-06-01-docu-parser-workflow-skills.md (ai-playground-docu-parser .claude/skills/{planning,review-fix,docs-check})
- 신규 3 페이지: concept(planning-eight-step-design, pr-review-fix-workflow, docs-six-axis-audit), 보강 1(ai-harness-pattern 인라인 백링크 + 관련 개념 3건)
- 범위: 새 프로젝트에 포팅 가능한 절차·결정 규칙만 (8단계 골격·ADR 자명성 게이트·6축·봇 루프 방지·학습 누적). 명령어 시퀀스·docu-parser 특화 세부 제외.
- release-flow/test-flow 는 NHN 인프라 특화라 work/nhn 으로 분리.

## [2026-06-01] add | 운영 트러블슈팅 topic 신설 — concepts 주제 분리
- 신규 1 페이지: topic(operations-troubleshooting)
- 보강: k8s-run-tmpfs-containerd·docker-compose-config-reload 에 topic 역백링크
- INDEX: "관측성·운영(학습)" → "관측성(학습)" + "운영·트러블슈팅(실전)" 분리, Topics 등록

## [2026-06-01] add | dooray-cli 도구 지식 — 사용·설계 패턴·MVP 방법론
- Source: raw/repos/2026-06-01-dooray-cli-tool-analysis.md (github.com/jon890/dooray-cli)
- 신규 1 페이지: concept(agent-friendly-cli-design)
- 보강 3 페이지: dooray-cli(도구 섹션 — 무엇/어떻게/어디에), ai-harness-pattern(하네스 정의 + MVP 3단계 워크플로), nhncloud-cli(agent-friendly 백링크)
- 평가: 도구 사용 지식은 비어 있고 하네스 관점만 있었음 → 도구 정체성·사용·설계 패턴을 채움. 개별 명령 문법은 --help/README 로 충분하여 제외

## [2026-06-01] add | AI 개발 하네스 topic 신설 — "업무 스타일" 카테고리 분리
- 신규 1 페이지: topic(ai-dev-harness)
- 보강: ai-harness-pattern 역백링크
- INDEX: "업무 스타일"(13개 비대) → "AI 개발 하네스"(8) + "개인 코딩 규율·취향"(5) 분리, Topics 등록
- 계기: 카테고리 비대 규약(brain-add 9단계) 작동

## [2026-06-01] move | OCR-docs → work/nhn 이동 + entity repo 링크 추가
- OCR-docs entity 를 public → work/nhn 이동(회사 OCR 문서 fork, 외부 유지보수 안 함). public 삭제.
- work-style: ocr-docs 제거(개인 프로젝트 7→6개), INDEX entity 제거.
- entity 6개에 GitHub repo 링크 추가(dooray-cli·nhncloud-cli·fos-blog·fos-accountbook·fos-accountbook-backend·fos-study).

## [2026-06-02] add | Claude Code rules + PR 컨벤션 (다른 레포 재사용)
- Source: raw/notes/2026-06-02-claude-rules-and-conventions.md
- 신규 2 (claude-code-memory-rules, pr-body-convention), 보강 1 (korean-readability-policy)
- 핵심:
  - .claude/rules 자동 로드 메커니즘
  - PR 본문 양식
  - 개인/팀 규칙 위치 분리(개인=~/.claude, 팀=레포 .claude/rules)

## [2026-06-02] add | OpenClaw topic 신설 — 게이트웨이 운영·설정 지식
- Source: raw/notes/2026-06-02-openclaw-knowledge-session.md (공식 docs + GitHub 소스 + doctor/CLI 실측)
- 신규 10 페이지: topic openclaw + concept 9개(overview, architecture, sessions, channels-routing, tool-policy, config, gateway-ops, cli-reference, message-tool)
- 보강 1 페이지: ai-nodes entity 에 [[openclaw]] 교차링크
- 계기: "작업 요청 → 관련 지식 탐색" 플로우용 일반 지식 누적(함정만 X). tool-policy allow 교집합 함정·웹UI↔Discord 미러링 한계 포함

## [2026-06-02] add | orphan transcript mining — openclaw-web-search 신규
- Source: ~/.openclaw/agents/main/sessions orphan transcript 442개 분석 (raw/notes/2026-06-02-openclaw-knowledge-session.md 에 mining 섹션 추가)
- 신규 1 페이지: openclaw-web-search (provider autodetect 우선순위·key-free·교훈)
- 보강 1 페이지: openclaw-channels-routing 에 discord requireMention 팁
- 실질 단물 1건 확인 — 나머지 440개는 cron 자동화·trajectory·checkpoint 노이즈 (정리 전 분석 ROI: 샘플 우선이 적중)

## [2026-06-06] add | 시판 육수 물냉면 조리법
- Source: raw/notes/2026-06-06-store-bought-naengmyeon.md
- 신규 1 페이지: simple-store-bought-naengmyeon
- 범위: 시판 냉면사리와 시판 동치미 육수를 기준으로 한 공개 가능한 범용 조리 지식. 개인 구매 맥락과 채널 맥락은 제외.

## [2026-06-08] add | ADR 가독성 형식 6원칙 (docs-first-adr 보강)
- Source: raw/notes/2026-06-08-adr-readability-comparison.md
- 신규 0, 보강 2 (docs-first-adr, korean-readability-policy 역참조)
- 핵심: 같은 planning 템플릿이라도 가독성은 semantic line break 적용 엄격도에서 갈린다. 대안 기각 옵션별 bullet·한 bullet 한 사실·호흡 일관성·상단 작성 원칙 주석·실측 근거·탐색성 anchor. 두 프로젝트 adr.md 비교에서 도출.

## [2026-06-09] add | 외부/내부 ingress controller 분리 패턴
- Source: raw/notes/ingress-controller-internal-external-split.md
- 신규 1 페이지(ingress-controller-internal-external-split), 보강 0

## [2026-06-12] add | SkillOpt 패턴 4개념 (brain-curate 첫 큐레이션)
- Source: raw/notes/2026-06-12-skillopt-sessions.md (fos-study·blog-post-writer 세션)
- 신규 4 페이지, 보강 1 페이지(self-improving-harness)
- brain-curate 스킬로 public 27세션 분석 → 81후보 → 병합 28 → SkillOpt 군 등록

## [2026-06-16] add | DB 커넥션 풀 사이징·함정 + 코딩하는기술사 채널 entity
- Source: raw/videos/2026-06-15-connection-pool-sizing.md (코딩하는기술사 유튜브, 멤버십·자동자막)
- 신규 2 concept(connection-pool-sizing, connection-pool-pitfalls) + 1 entity(coding-engineer-tv)
- 보강 1: red-use-metrics (Saturation↔커넥션 풀 한계 연결)

## [2026-06-16] add | 하네스 강화 — 전용 agent·pitfalls 구조·부트스트랩 (3 concept)
- Source: raw/notes/2026-06-12-docu-parser-harness-evolution.md (섹션 1·5) + docu-parser .claude/ 실측
- 신규 3 concept(custom-domain-agent, pitfalls-file-per-pattern, harness-bootstrap-checklist), 보강 1(ai-harness-pattern 백링크 3)
- 2026-06-12 raw note 의 보강-보류분을 정식 concept 으로 승격. brain-add 에 HTML 미리보기(6b) + brain-preview 생성기 번들화(scripts/+templates/) 반영.

## [2026-06-17] add | 문서 파싱 품질 평가 방법론 (brain-curate 증분, public)
- Source: raw/web/2026-06-17-parsing-quality-eval.md (docling-eval·NED 공개 출처)
- 신규 1 page(document-parsing-quality-evaluation), 품질 평가 소분류 신설

## [2026-06-25] add | NAVER D2 GNOSIS 에이전트 자율 성장 프레임워크
- Source: raw/videos/2026-06-17-naver-d2-gnosis-agent-autonomous-growth.md (YouTube 자동자막 기반, 수치·실험은 발표자 자체 평가로 취급)
- 신규 3 페이지: gnosis-agent-autonomous-growth, agent-autonomy-growth-levels, constitutional-growth-gate
- 보강 2 페이지: ai-harness-pattern, self-improving-harness
