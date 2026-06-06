---
type: entity
created: 2026-05-28
updated: 2026-05-28
---

# ai-nodes (fos-claw)

개인 자동화 에이전트 모노레포. 재사용 워크스페이스들의 단일 출처(source-of-truth).
GitHub: `jon890/fos-claw` (public).

## 개요

- 멀티 워크스페이스 컨테이너 — 최상위 디렉터리 각각이 자체 skills·data·logs·config 를 가진 독립 워크스페이스다.
- 워크스페이스
  - apartment — 일일 아파트 시세 리포트
  - career-os — 면접·커리어 준비 자동화
  - stock-investment — 일일 주식·암호화폐 모닝 브리핑
  - travel — 여행별 일정·결정 로그
  - health-care — 재활 daily 체크인(cron)
- 오케스트레이션 — 영속 워크플로 로직은 `~/ai-nodes`, `~/.openclaw` 는 thin glue 로 유지한다([[openclaw]]).

## 핵심 패턴

- [[multi-workspace-monorepo]] — 워크스페이스 격리와 `_shared` 규율
- [[script-skill-separation]] — 실행(scripts)/컨텍스트(.claude/skills) 분리(ADR-006), native skill 직접 호출

## 같은 결의 하네스 (작성자 시그니처)

- [[ai-harness-pattern]] — 개발 프로젝트 하네스
- [[self-improving-harness]] — 회고 학습 누적
- [[docs-first-adr]] — ADR 누적과 docs-style(ADR-005)
- [[work-style]]

## Sources

- github.com/jon890/fos-claw — `AGENTS.md`, `README.md` (public repo)
