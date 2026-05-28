# Wiki Log

Append-only 연대기. ingest·query·lint skill 이 매번 한 줄 append 한다. 사용자도 LLM 도 기존 항목을 수정·삭제하지 않는다. `grep '## \[2026-05' log.md` 같은 검색으로 진화 타임라인을 추적할 수 있다.

형식: `## [YYYY-MM-DD] {ingest|query|lint} | <한 줄 설명>` 다음 줄에 세부 메모.

---

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
