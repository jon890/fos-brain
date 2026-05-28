# Wiki Index

이 파일은 `wiki/` 의 전체 목차다. LLM 이 Q&A·ingest·lint 시 가장 먼저 읽는 진입점.

각 항목은 `- [[페이지명]] — 한 줄 요약` 형식. 사용자는 직접 수정하지 않으며, ingest/lint skill 이 갱신한다.

## Topics

- [[topics/rag-system-architecture-strategies]] — Workflow / Logic / Data Quality 3대 축으로 본 기업별 RAG 구축 전략 비교

## Concepts

- [[concepts/toss-park-ssi-rag]] — 토스 프론트엔드의 Slack 통합 RAG 봇, 순환형 지식 파이프라인
- [[concepts/docflow-code-to-doc]] — JSDoc → CI 강제 → 문서 최신성 보장. Toss RAG 의 Ingestion 측 메커니즘
- [[concepts/woowa-mulebose-text-to-sql]] — 우아한형제들의 자연어→SQL RAG, 데이터 리터러시 격차 해소
- [[concepts/multi-chain-rag-architecture]] — Router Supervisor + 의도별 특화 체인 라우팅 패턴
- [[concepts/sionic-vlm-document-parsing]] — VLM 2-Stage 파싱 + 자연어 직렬화, 파서 교체만으로 정확도 20%+ 향상

## Raw 인벤토리 요약

- `raw/web/` — Web Clipper 로 수집한 웹 기사 (현재 비어있음)
- `raw/papers/` — PDF 논문·문서 및 추출 텍스트 (1개: RAG 아키텍처 분석)
- `raw/repos/` — 코드 저장소 스니펫·README (현재 비어있음)
- `raw/notes/` — 사용자 메모·업무 기록 중 raw 로 승격된 노트 (1개: 다른 기업의 RAG 시스템 발표자료)

## 메타

- 전체 활동 연대기: [[log]] (append-only)
- 마지막 ingest: 2026-05-19
- 마지막 lint: 2026-05-19
- 검색 도구: qmd (컬렉션 `brain-wiki`, `brain-raw`). 사용법은 [[../CLAUDE]] 의 "검색 도구: qmd" 섹션 참조.
