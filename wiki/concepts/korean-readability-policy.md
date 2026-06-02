---
type: concept
created: 2026-05-28
updated: 2026-05-28
---

# 한국어 표현·마크다운 가독성 정책

문서·커뮤니케이션의 한국어 문체와 마크다운 형식을 규칙화하고, 코드 리뷰 점검으로 강제한다.

## 핵심 포인트

- **외래어 금지 매핑 표**: 한국 사용자가 한 번에 이해하기 어려운 외래어를 우리말로 바꾼다(예: 매트릭스→표, 게이트→점검, 트리아지 회피). 기술 식별자는 예외로 둔다.
- **마크다운 가독성 6패턴** — 아래 규칙을 모두 준수한다.
  - semantic line break — 문장당 1줄
  - 항목 3개 이상이면 콤마 나열 금지, bullet 으로 분리
  - 한 bullet 에 다중 sub-rule 압축 금지
  - 인라인 연결(`A + B`) 금지
  - Bold+괄호는 `**텍스트**(영문)` 형태만
  - 표 셀 4+ 정보는 `<br>` 분리
- **금지 기호** — 두 가지를 사용하지 않는다.
  - `~` — 취소선 오작동
  - `§` — 직관 어려움
- **정적 검사 + 일괄 수정**: 위반(예: fos-blog `§ 39건`, `~ 82건`)을 자동 탐지해 한 번에 교정한다.
- **공개 저장소 일반화**: 사내 명칭·링크·멤버 ID 를 placeholder 로 바꾼다(예: Dooray → "사내 협업 도구").

## 추가 (2026-06-02): 개인 글로벌 rules 로 관리

이 정책은 **개인 취향 규칙**이지 팀 강제 규칙이 아니다 — 그래서 개인 글로벌에만 둔다.

- 배치: `~/.claude/rules/korean-style.md` (외래어 매핑 표·종결 규칙·자가 점검) + `~/.claude/CLAUDE.md` 에서 `@~/.claude/rules/korean-style.md` import.
- `~/.claude/rules/` 는 내 모든 레포에 자동 적용되므로 레포마다 복제할 필요가 없다 ([[claude-code-memory-rules]]).
- **레포 문서가 이 개인 룰을 참조하지 않게 한다** — 팀원에겐 `~/.claude/...` 파일이 없어 깨진 참조가 된다. 레포 CLAUDE.md 에서 한국어 정책 언급·링크를 제거하고 "작성자 개인 환경에 맡김" 으로 둔다 (docu-parser 에서 실제로 그렇게 분리).
- 대비: PR·Dooray 컨벤션은 팀 공유라 레포 `.claude/rules/` 에 둔다 ([[pr-body-convention]], [[dooray-task-convention]]). 개인 취향(한국어·가독성)과 팀 공유를 위치로 가른다.

## 관련 개념

- [[docs-first-adr]] — docs 가 이 문체 규칙의 주 적용 대상
- [[self-improving-harness]] — docs-audit 가 문체 위반을 축으로 점검
- [[claude-code-memory-rules]] — 이 정책을 개인 글로벌 rules 로 자동 적용하는 메커니즘

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
