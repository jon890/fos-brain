---
type: raw
created: 2026-06-12
---

# adr.md 디렉터리 분리 — 머지 충돌 구조 제거 (docu-parser plan043)

docu-parser 세션에서 ADR 관리 구조를 단일 adr.md → docs/adr/NNN-slug.md + INDEX 라우터로 분리하기로 설계했다.

## 배경 (반복되는 충돌)
- PR #166(golden 채점 ADR-028)이 main 의 ADR-029(HWP)와 adr.md 끝줄에서 머지 충돌.
- 같은 PR 이 회피 패턴 wiki(pitfalls)의 INDEX plan 카운트도 충돌(38 vs 39 → 양쪽 추가로 실제 40).
- 매 PR 반복되는 패턴 — append 위치가 겹친다.

## 관찰 (이미 충돌 없는 구조가 있었다)
- pitfalls 는 파일 per 패턴 + INDEX 라우터라 본문 충돌이 거의 없다 (INDEX 카운트 1줄만 충돌).
- 같은 구조를 ADR 에 이식하면 adr.md 끝줄 충돌이 사라진다.

## 설계 (plan043)
- docs/adr/NNN-slug.md 파일 per ADR + docs/adr/INDEX.md 라우터.
- 번호를 파일명에 유지 → 100여 곳의 ADR-NNN 참조 무손상 + NNN-* glob 으로 slug 없이 발견.
- 분리 시 "잘 참조되나" 발견성 검토를 먼저 했다 — 번호 glob + INDEX 라우터로 보존 확인.
- 스킬(docs-check 의 ADR Index·앵커 동기화, planning 의 번호 grep)도 디렉터리 기반으로 재작성.

## 일반화
- 누적 append 파일은 머지 충돌 자석. 파일 per 항목 + INDEX 라우터로 분해.
- 한 곳에서 검증된 구조 패턴을 증상이 같은 다른 곳으로 이식한다.
