---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# fos-study

개인 기술 블로그 겸 학습 기록 저장소(마크다운). GitHub sync 로 [[fos-blog]] 에 게시된다.

## 개요

- 구성: 순수 마크다운. `.md` 경로 링크만, H1 제목 인덱싱.
- 아키텍처: 기술 도메인 폴더(architecture/database/java/devops/kafka/...) + 개인 폴더(finance/travel/resume/interview). 개념(architecture/)과 회사 업무 사례(task/)를 엄격 분리. 영문 kebab-case 파일명.
- 하네스: 스킬 — blog-post-writer(민감정보 제거)·docs-audit(7축 + Quality Loop, sub-agent 병렬)·resume-writer. 에이전트 3(cross-link/orphan/readme auditor).

## 특이점

- AI 하네스로 글쓰기 자체를 운영. 문체 정적 검사·일괄 수정. 학습/면접 가치 기준 정원 가꾸기식 유지보수.

## 보여주는 스타일

- [[../concepts/self-improving-harness]]
- [[../concepts/korean-readability-policy]]
- [[../concepts/docs-first-adr]]
- [[../topics/work-style]]

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
