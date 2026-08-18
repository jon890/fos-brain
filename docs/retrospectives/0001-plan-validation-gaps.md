---
id: RETRO-0001
plan: plan1-okf-retrieval-visualization
date: 2026-08-18
phase: critic
status: 해결
category: 프로세스
promotion: 승격 안 함
---

# 실행 환경과 측정 대상이 빠진 계획

## 관찰

첫 critic 평가에서 Quartz 검사 환경, SCSS를 불러오는 컴포넌트 검사 방식, YAML 보존 범위, 검색 benchmark 대상이 닫혀 있지 않아 REVISE 판정을 받았다.

## 원인

기능 계약은 정했지만 검증 명령이 새 worktree에서 바로 실행되는지와 전역 상태를 읽는 검사가 무엇을 측정하는지는 계획 단계에서 실측하지 않았다.

## 영향

그대로 구현했다면 컴포넌트 단위 검사가 SCSS 적재에서 실패하고, 검색 benchmark가 branch 변경 효과를 재는 것처럼 오해될 수 있었다.

## 대응

Quartz 의존성 설치를 선행 단계에 추가하고 SCSS가 없는 순수 helper만 단위 검사하도록 바꿨다.
내보내기는 frontmatter를 재직렬화하지 않게 했고, 검색 benchmark는 등록된 `brain-wiki`의 smoke임을 명시했다.

## 검증

critic 재평가에서 네 모호점이 실제 계획에 반영됐음을 확인하고 APPROVE 판정을 받았다.

## 배운 점

검증 명령은 동작 이름만 적지 말고 새 worktree의 설치 상태와 외부 상태가 측정 범위에 미치는 영향까지 닫아야 한다.

## 후속

기존 planning과 critic 계약이 같은 유형의 누락을 이미 검출하므로 별도 규칙으로 승격하지 않는다.
