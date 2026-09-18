---
type: concept
created: 2026-05-28
updated: 2026-08-31
title: 자기개선 하네스
description: 반복 교훈을 실제 소비되는 문서와 결정적 검사에 환원하고 소비되지 않는 산출물은 제거하는 루프
tags: [ai-harness, feedback-loop, documentation]
---

# 자기개선 하네스

하네스가 작업하면서 발견한 반복 가능한 교훈을 스킬, 문서와 결정적 검사에 환원해 다음 작업의 품질을 높이는 루프다.

## 핵심 포인트

- PR 리뷰의 일반화 가능한 교훈을 실제 소비 경로에 반영한다.
- 스킬 실행 중 발견한 안티패턴은 해당 스킬의 소유 경계나 저장소 반복 함정 문서에 반영한다.
- 작성자와 critic·docs-verifier를 분리해 자기 승인을 막는다.
- 문서는 keep, refresh, merge, archive와 delete로 분류해 주기적으로 정리한다.
- 반복 결함을 lint, test와 정적 검사로 옮겨 산문 지시를 줄인다.
- SkillOpt처럼 편집 예산과 검증 점검을 둔 외부 방법론을 참고할 수 있다.

## 역할별 피드백 라우팅

평가자마다 발견을 환원할 단일 원본이 다르다.

- critic의 REVISE: plan 설계 패턴이나 planning 계약
- code-reviewer의 FIX: code-review 패턴이나 결정적 테스트
- docs-verifier의 UPDATE: 책임 문서, 문서 영향 표나 docs 검사기

중요한 것은 역할별 원시 회고 파일을 만드는 것이 아니라 발견을 올바른 소유자에게 보내는 것이다.
별도 회고 문서가 생기면 그것도 소비자와 수명주기가 필요한 새 rot 원천이 된다.

## 회피 패턴 wiki 운영

리뷰 학습은 카테고리 디렉터리와 라우터로 운영한다.
구조 패턴은 [[merge-conflict-free-append]], 구체 운영 규율은 [[pitfalls-file-per-pattern]]이 설명한다.

- INDEX에서 이번 변경 유형을 찾고 필요한 파일만 읽는다.
- 각 패턴의 `triggers`로 검색 범위를 좁힌다.
- 재발성, 심각도, 도구 검출 여부와 일반화 가능성을 모두 확인한다.
- 도구로 잡을 수 있으면 문서 대신 lint, test나 정적 검사로 승격한다.

## 추가 (2026-06-25): 건강한 망각과 스킬 생명주기

GNOSIS 발표는 성장형 에이전트가 스킬을 무제한 누적하면 안 된다고 본다.
스킬에는 seed, developing, active, degrading과 archived 상태가 있다.

학습은 추가만으로 완성되지 않는다.
오래된 패턴을 삭제하거나 자동 검사로 승격하고, 더 이상 유효하지 않은 규칙은 archive해야 한다.
품질 기준은 얼마나 많이 배웠는지가 아니라 살아 있는 규칙과 죽은 규칙을 구분했는지까지 포함한다.

## 추가 (2026-08-31): 보존보다 소비를 기준으로 삼는다

원시 회고 파일과 `RUNS.md`를 여러 작업에서 의무 생성했지만 실제 소비 코드는 없었다.
실행 횟수와 판정 수치는 다음 계획이나 검토의 입력으로 쓰이지 않았고, 승격 뒤에도 원본을 보존해 같은 교훈이 두 문서에 남았다.

따라서 위의 역할별 회고 분리에서 파일 저장을 요구하던 계약은 다음 원칙으로 대체한다.

1. 일회성 사건과 실행 통계는 PR과 작업 보고에만 둔다.
2. 다음 작업이 실제 읽을 교훈만 소유 문서에 직접 반영한다.
3. 반복 함정은 [[pitfalls-file-per-pattern]]의 조건을 통과할 때만 패턴당 한 파일로 저장한다.
4. 코드로 검출할 수 있으면 문서 대신 테스트나 정적 검사로 옮긴다.
5. 소비자가 없어진 스킬, 로그와 문서는 삭제하고 Git 이력을 보존 기록으로 사용한다.
6. 완료된 task는 전달 산출물로 보고, 현재 코드·ADR·승격 패턴에 남지 않은 요구는 필요할 때 다시 planning한다.

자기개선 루프의 성공 기준은 기록량이 아니라 다음 실행의 판단과 검증을 실제로 바꾸는가이다.

## 관련 개념

- [[ai-harness-pattern]]: 이 루프가 붙는 베이스 하네스
- [[skillopt-trainable-skill-document]]: 수동 루프를 자동화·형식화한 외부 방법론
- [[merge-conflict-free-append]]: 파일 per 패턴과 INDEX 구조
- [[pitfalls-file-per-pattern]]: 반복 함정의 승격, 소비와 삭제 규칙
- [[testing-philosophy]]: 반복 결함을 결정적 검사로 승격하는 검증 방식
- [[execution-log-vs-retrospective]]: 실행 산출물과 승격 지식의 수명주기

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]]: 역할별 피드백과 회피 패턴 wiki 운영
- [[../../raw/videos/2026-06-17-naver-d2-gnosis-agent-autonomous-growth.md]]: 스킬 생명주기와 건강한 망각
- [[../../raw/notes/2026-08-31-harness-retros-cleanup.md]]: 원시 회고와 실행 통계의 실제 소비 경로 감사
