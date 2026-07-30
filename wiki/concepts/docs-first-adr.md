---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# docs-first + ADR 운영

의사결정을 코드 변경보다 먼저 문서에 남기고, ADR(Architecture Decision Record)로 누적·관리하는 규율.

## 핵심 포인트

- **docs = source of truth**: 백엔드 레포는 CLAUDE.md 와 docs 가 충돌하면 docs 를 우선한다.
- **표준 docs 세트** — 6개 파일을 기본으로 유지한다.
  - `prd.md`, `flow.md`, `adr.md`
  - `code-architecture.md`, `data-schema.md`, `testing-strategy.md`
- **ADR 원칙** — 아래 세 조건을 만족하는 결정만 기록한다.
  - 기술 의사결정만
  - 최종 상태만
  - 코드로 자명하지 않은 것만
  - 주기적으로 slim·retire한다.
- **번호 체계**: 레포별 prefix를 사용한다(예: 가계부 F=프론트 / B=백엔드, `ADR-B16`).
- **변경-상황 매핑 표**: 작업 종류별 필독 ADR 을 표로 강제해 라이브러리 함정 재발을 막는다.
- **docs 는 AI 컨텍스트용** — 다음 원칙으로 작성한다.
  - 간결하게, 중복 제거
  - "왜"만 기록
  - 코드 스니펫은 넣지 않는다(구현 세부는 코드가 자명).
- **task 생성 전 docs commit**: 설계 결정이 먼저 커밋된 뒤 구현 task 가 만들어진다.

## 추가 (2026-06-08): ADR 가독성 형식

같은 planning 템플릿(결정 / 맥락 / 대안 기각 / 트레이드오프)을 써도 ADR 가독성은 갈린다.
두 프로젝트 `adr.md` 비교에서 도출한 형식 원칙 — **가독성 차이는 템플릿이 아니라
semantic line break 적용 엄격도에서 나온다.**

- **대안 기각은 옵션마다 별도 bullet** (`**옵션** — 이유`).
  괄호 인라인 나열(`A(이유), B(이유)`)은 대안 비교가 눈으로 안 된다.
  마크다운 가독성 규칙의 "인라인 연결 금지" 원칙을 ADR 에 적용한 것이다.
- **한 bullet = 한 사실** — 200자 초과 bullet 은 정보 4개가 뭉친 신호라 분리한다.
- **모든 ADR 이 같은 호흡** — 초기 압축 / 후기 과밀 편차를 피한다. 한 파일 안에서 ADR 마다 밀도가 다르면 읽는 호흡이 끊긴다.
- **파일 상단에 작성 원칙 1줄** — "결정의 무엇·왜·대안만, 구현 세부는 코드에", planning ADR 점검 링크를 함께 둔다. 미래 작성자에게 형식을 고정한다.
- **근거는 실측 수치로** — 운영 측정값·`%`·확인 날짜를 적는다. 정성 서술보다 결정의 신뢰도가 산다.
- **탐색성 — ADR Index(클릭 목차)와 anchor 병행** — 구분선만 두는 것보다 인덱스가 있으면 긴 `adr.md` 에서 특정 ADR 로 바로 점프할 수 있다.

## 관련 개념

- [[ai-harness-pattern]] — planning 스킬이 docs 를 산출하는 단계

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/notes/2026-06-08-adr-readability-comparison.md]]
