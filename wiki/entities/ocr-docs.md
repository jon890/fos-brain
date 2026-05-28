---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# OCR-docs

NHN Cloud OCR 공개 문서 저장소(TOAST-DOCS/OCR fork). docs.nhncloud.com 으로 외부 공개.

## 개요

- 구성
  - 순수 마크다운
  - gh CLI PR 연동
  - dooray-cli 사내 이슈 연동
  - fork/upstream 동기화
- 아키텍처
  - 언어 디렉터리: `ko` (원본) → `en`, `ja`, `zh`
  - 파일명 패턴: `{document|general}-{ocr|ai}-{api-guide|console-guide|error-code|release-notes}[-vX.Y].md`
  - ko 가 source-of-truth
- 하네스
  - 스킬 4개
    - api-guide
    - docs-i18n-sync (ko → en/ja/zh)
    - dooray-task-to-docs-update (사내 이슈 → 공개 PR)
    - sync-upstream

## 특이점

- 공개 저장소 보안을 하네스에서 강제 — CLAUDE.md(로컬 전용)가 사내 링크·업무번호·멤버 ID 금지, placeholder 만 허용.
- 커밋 이모지→Conventional 마이그레이션 중. scope 에 경로를 넣는 변형.

## 보여주는 스타일

- [[../concepts/ai-harness-pattern]]
- [[../concepts/commit-convention-style]]
- [[../concepts/korean-readability-policy]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
