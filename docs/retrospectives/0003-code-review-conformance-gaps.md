---
id: RETRO-0003
plan: plan1-okf-retrieval-visualization
date: 2026-08-18
phase: code-review
status: 해결
category: 결함
promotion: docs/code-architecture.md
---

# 묶음 전체가 아닌 wiki만 검사해 OKF 규격 위반을 놓침

## 관찰

코드 리뷰에서 public raw Markdown 26개가 `type` 없이 OKF 묶음에 포함되는 문제를 발견했다.
setup-check와 검색 벤치마크에는 고정 wrapper가 없을 때 PATH의 qmd를 실행하는 경로도 남아 있었다.
Quartz 검증 명령은 gitignore에 없는 검사 산출물도 만들었다.

## 원인

초기 내보내기 검사는 wiki 문서와 private 제외만 확인하고 묶음 안의 모든 비예약 Markdown을 걷지 않았다.
qmd 검사는 실행 성공에 집중해 저장소의 고정 ABI 계약보다 PATH 호환을 우선했다.
검증 산출물은 명령 성공 여부만 보고 작업 트리 상태를 함께 확인하지 않았다.

## 영향

내보내기 명령은 성공하지만 결과가 OKF v0.2 규격을 완전히 충족하지 않았다.
환경에 따라 다른 qmd 런타임이 실행되면 ABI 문제가 다시 묻힐 수 있었다.
검사 뒤 미추적 파일이 PR 작업 트리에 남았다.

## 대응

raw Markdown은 내보내기 사본에만 `type: Reference`를 넣고 원본 본문과 wikilink를 보존했다.
setup-check와 검색 벤치마크는 고정 qmd wrapper만 실행하도록 바꿨다.
Quartz 검사 산출물 두 경로를 `.gitignore`에 추가했다.

## 검증

내보내기 단위 검사에서 모든 비예약 Markdown의 frontmatter와 `type`을 확인한다.
실제 public 내보내기에도 같은 전체 파일 검사를 적용한다.
검색 벤치마크는 고정 wrapper로 5개 질문을 모두 통과해야 한다.
Quartz 통합 검사 뒤 작업 트리에 검사 산출물이 나타나지 않아야 한다.

## 배운 점

교환 형식 검사는 대표 문서가 아니라 묶음 전체의 불변 조건을 검사해야 한다.
고정 런타임 계약이 있으면 PATH fallback은 가용성 향상이 아니라 다른 실행 환경을 숨기는 경로가 된다.

## 후속

OKF 규격이 바뀌면 전체 Markdown walker의 예약 파일과 필수 필드 조건을 함께 갱신한다.
