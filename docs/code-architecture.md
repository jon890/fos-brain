# 코드 아키텍처

## 책임 경계

### 지식 원본과 문서

- `raw/` — public 원본의 변경 불가 저장소다.
- `wiki/` — 에이전트와 Quartz가 함께 읽는 컴파일된 지식이다.
- `private/` — 독립 저장소이며 public 산출물에서 제외한다.

### 에이전트 검색과 교환

- `.agents/plugin/fos-brain/skills/brain-search/` — 네임스페이스 분리, wiki 우선 검색, 링크 탐색, 근거 작성 절차를 소유한다.
- `.agents/plugin/fos-brain/skills/brain-add/` — 새 문서의 메타데이터 작성과 검색 검증 절차를 소유한다.
- `.agents/plugin/fos-brain/scripts/` — OKF 내보내기와 검색 벤치마크처럼 반복 실행해야 하는 결정적 동작을 소유한다.
- `.agents/plugin/fos-brain/tests/` — 내보내기 계약과 스크립트 회귀를 검증한다.

스킬은 언제 어떤 단계를 실행할지 설명한다.
다섯 줄을 넘는 파싱, 변환, 판정은 스크립트에 둔다.

### 사람용 렌더링

- `quartz/quartz/components/KnowledgeMeta.tsx` — 페이지 frontmatter를 사람이 읽는 설명·신뢰·최신성 표시로 바꾼다.
- `quartz/quartz/plugins/emitters/contentIndex.tsx` — 그래프가 사용할 문서 유형을 콘텐츠 색인에 포함한다.
- `quartz/quartz/components/Graph.tsx` — 유형 범례를 렌더한다.
- `quartz/quartz/components/scripts/graph.inline.ts` — 문서 유형별 노드 색을 선택한다.

표시 컴포넌트는 frontmatter가 일부만 있어도 동작해야 한다.
OKF 내보내기 로직을 Quartz에 넣지 않고 교환 경계를 별도 스크립트로 유지한다.

## 의존성

새 외부 의존성은 추가하지 않는다.
검색은 설치된 qmd를 사용하고, 내보내기 스크립트는 Node.js 표준 라이브러리만 사용한다.
Quartz는 기존 Preact, TypeScript, SCSS, PixiJS를 재사용한다.
qmd 명령은 고정 wrapper만 실행하며, wrapper가 없으면 PATH의 실행 파일을 대신 사용하지 않는다.

내보내기 스크립트는 YAML 객체를 자체 파서로 재구성하지 않는다.
기존 frontmatter 원문을 보존하고 최상위 키의 존재만 감지한 뒤, 누락된 교환 필드를 JSON 호환 YAML 값으로 삽입한다.
기존 `sources`, `generated`, `verified` 구조는 내용 손실 없이 그대로 통과시킨다.
`title`, `description`, `generated` 보완은 concept, topic, entity 문서에만 적용한다.
묶음의 `index.md`와 `log.md`는 예약 문서로 별도 처리한다.
raw Markdown은 내보내기 사본에서만 `type: Reference`를 보완하고 원본 본문을 유지한다.

## 검증 경계

- 검색 벤치마크 — 대표 질문마다 기대 slug의 상위 순위를 검사한다.
- OKF 내보내기 — 임시 fixture를 내보내고 메타데이터, raw Reference, 예약 문서, 링크, private 제외를 검사한다.
- Quartz — SCSS를 불러오지 않는 순수 메타데이터 helper의 단위 검사, TypeScript 검사, 공개 정적 빌드를 실행한다.
- 스킬 — `quick_validate.py`로 수정한 skill 폴더를 검사한다.
