---
source_type: claude-session-curation
collected: 2026-08-26
sessions:
  - fos-blog
  - dooray-cli
  - nhncloud-cli
generated:
  by: Codex
  at: 2026-08-26
---

# Claude Code 세션에서 정제한 개인 지식

2026-08-25 이후 Claude Code 세션을 큐레이션해 장기 보관 가치가 있는 개인 취향과 결정만 정리했다.
회사 프로젝트의 구현 내용과 운영 기록, 실제 자격증명 값은 포함하지 않았다.

## 모바일 시각 자료

복잡한 다이어그램을 작은 화면에 맞춰 축소한 상태로 고정하면 내용을 읽기 어렵다.
모바일에서도 사용자가 확대하고 이동하며 세부를 읽을 수 있는 형태를 선호한다.

## CLI mutation과 캐시

캐시된 엔티티를 변경하는 mutation은 service 계층이 성공 결과와 캐시 무효화를 함께 책임진다.
API client는 순수 HTTP 래퍼로 유지해 캐시 정책과 전송 책임을 섞지 않는다.

## CLI 자격증명과 설정

서비스 appkey는 권한이 제한된 profile 자격증명에 둔다.
배포 대상처럼 client가 관리하는 좌표는 일반 config에 두어 비밀과 실행 설정의 책임을 분리한다.
하나의 profile은 하나의 대상 자격증명 집합을 나타내도록 관리한다.

## 에이전트 실행 컨텍스트

큰 구현과 검증은 별도 실행 세션에 맡기고 부모 세션은 목표, 판단과 통합 검증 문맥을 유지한다.
반복 실행 순서는 orchestration과 build-with-teams 같은 스킬이 맡는다.
brain에는 특정 명령이 아니라 부모 판단 문맥을 보존한다는 개인 운영 원칙만 남긴다.

## 제외한 내용

- 회사 배치, OCR, 문서 파서와 사내 ADR 작업은 nbrain 대상이라 제외했다.
- 특정 평가 실행 절차는 해당 저장소 문서가 단일 소스라 제외했다.
- 한국어 PR과 게시 미리보기 규칙은 AGENTS.md와 관련 스킬이 단일 소스라 제외했다.
