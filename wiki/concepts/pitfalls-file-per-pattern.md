---
type: concept
created: 2026-06-16
updated: 2026-08-31
title: "회피 패턴 wiki: 파일-per-패턴과 INDEX 라우터"
description: 반복 함정을 패턴당 한 파일로 저장하고 실제 소비되는 항목만 INDEX로 선택하는 운영 원칙
tags: [ai-harness, pitfalls, documentation]
---

# 회피 패턴 wiki: 파일-per-패턴과 INDEX 라우터

하네스가 누적하는 회피 패턴을 모놀리식 문서가 아니라
패턴 하나당 파일 하나로 쪼개고, INDEX 라우터로 작업 유형에 맞는 파일만 골라 읽는 구조다.

## 왜 파일을 쪼개나

- 모놀리식 문서는 작업마다 무관한 패턴까지 컨텍스트에 올려 토큰을 낭비하고 핵심을 묻는다.
- 파일 per 패턴이면 INDEX 라우터로 이 작업의 변경 유형 행만 골라 해당 파일만 읽는다.
- 끝에 append 하지 않으니 두 PR 이 동시에 패턴을 추가해도 머지 충돌이 없다([[merge-conflict-free-append]]).

## 소비 방식

1. INDEX 라우터 표에서 지금 작업의 변경 유형 행을 찾는다.
2. 그 행이 가리키는 패턴 파일만 읽고 self-check 한다.
3. 애매하면 카테고리 디렉터리를 통째로 읽는다. 과소 선택보다 안전하다.

## 카테고리와 소비 시점

| 카테고리 | 호출 시점 | 사용 스킬 |
|---|---|---|
| plan | task 파일 작성 직후 self-check | planning, build-with-teams |
| team | 팀원 스폰·메시지 작성 시 | build-with-teams |
| code-review | 코드 작성·리뷰 시 | build-with-teams, review-fix |

## 축적 점검

새 패턴은 다음 조건을 모두 통과할 때만 파일로 추가한다.

1. 재발성: 두 번 이상 재발했거나 다른 코드에서도 날 구조적 가능성이 있다.
2. 심각도: 데이터 손상, 문서 전체 실패나 보안처럼 영향이 크다.
3. 도구로 못 잡음: 린터, 타입 검사와 테스트가 이미 잡는 것은 추가하지 않는다.
4. 추상화 가능: 특정 사건을 넘어 일반화된다.

## prune과 automate

분기마다 다음을 점검한다.

- prune: 가리키는 코드가 사라진 stale 파일을 삭제하고 같은 커널의 중복 파일을 합친다.
- automate: 도구로 잡을 수 있는 패턴은 린터, ast-grep이나 테스트로 옮기고 문서를 삭제한다.

## 파일 형식

frontmatter에는 `id`, `category`, `triggers`, `tool_catchable`, `source`, `related`를 둔다.
본문은 증상, Good, 검출, Self-check와 Why로 구성한다.

- 사고 사례는 하나로 충분하다.
- 왜 가드가 필요한지 한 줄 근거를 남긴다.
- 검출 명령을 함께 적어 다음 작업의 사전 점검에 쓴다.
- `triggers`에는 변경 유형 키워드를 적는다.

## 링크 규칙

- 패턴 간 참조는 본문 끝 `관련:` 뒤에 경로 없는 slug wikilink로 적는다.
- `@경로` import는 쓰지 않는다. 내용을 자동 포함하면 선택적 로드가 깨진다.
- INDEX의 카테고리 목록만 Markdown 링크로 두어 탐색 허브로 쓴다.

## 추가 (2026-08-31): 원시 회고를 지식 문서로 저장하지 않는다

패턴 문서 앞에 원시 회고와 실행 통계를 한 층 더 두는 구조를 실제로 운영했지만,
후속 분석이 이를 읽지 않아 같은 사건이 `docs/retrospectives/`, `RUNS.md`와 `docs/pitfalls/`에 중복됐다.

현재 원칙은 다음과 같다.

- 일회성 실패, 특정 plan의 사건과 실행 통계는 PR과 작업 보고에서 끝낸다.
- 재현 가능하고 일반화되며 검출 방법이 있는 교훈만 `docs/pitfalls/`에 승격한다.
- 승격할 때 같은 패턴이면 기존 파일을 고치고 별개 패턴일 때만 새 파일을 만든다.
- 저장소가 반복 함정 위치와 형식을 지정하지 않으면 파일을 만들지 않는다.
- 정리 시점은 원시 회고 개수가 아니라 분기 점검과 구조 변경 후 감사로 정한다.

이 변경은 기록을 덜 남기는 것이 아니라 실제 소비되는 단일 원본만 남기는 선택이다.
[[self-improving-harness]]의 피드백 루프도 같은 원칙을 따른다.

## 관련 개념

- [[self-improving-harness]]: 반복 교훈을 실제 소비되는 단일 원본으로 환원하는 루프
- [[execution-log-vs-retrospective]]: 원시 사건과 승격 지식의 수명주기
- [[merge-conflict-free-append]]: 파일 per 항목과 INDEX로 충돌을 줄이는 일반 구조

## Sources

- [[../../raw/notes/2026-06-12-docu-parser-harness-evolution.md]]: pitfalls 파일-per-패턴과 INDEX 라우터 구조
- [[../../raw/notes/2026-08-31-harness-retros-cleanup.md]]: 원시 회고와 RUNS 소비 경로 감사, 공용 스킬 계약 제거
