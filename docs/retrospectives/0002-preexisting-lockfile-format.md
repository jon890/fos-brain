---
id: RETRO-0002
plan: plan1-okf-retrieval-visualization
date: 2026-08-18
phase: phase-03
status: 진행 중
category: 범위 외
promotion: 검토 중
---

# 기존 lockfile 형식 불일치가 통합 검사를 막음

## 관찰

Quartz의 `pnpm check`에서 TypeScript 검사는 통과했지만 변경하지 않은 `pnpm-lock.yaml`이 Prettier 검사에 실패했다.

## 원인

현재 main의 lockfile 형식이 저장소가 설치한 Prettier 버전의 출력과 일치하지 않는다.

## 영향

이번 변경 파일의 형식과 동작이 정상이어도 저장소 단위 검사 명령은 0이 아닌 종료 코드로 끝난다.

## 대응

Phase 3에서는 변경 파일만 Prettier로 검사하고, TypeScript 검사와 단위 검사와 정적 빌드를 별도로 통과시켰다.
범위 밖 lockfile 변경 여부는 통합 검증 분기에서 결정한다.

## 검증

`pnpm exec tsc --noEmit`, 변경 파일 대상 `pnpm exec prettier --check`, `pnpm test`, `pnpm quartz build`가 통과했다.
`git diff --exit-code -- pnpm-lock.yaml`도 통과해 이번 작업이 lockfile을 바꾸지 않았음을 확인했다.

## 배운 점

복합 검사 명령이 실패하면 하위 단계별 결과와 변경 파일 책임을 분리해야 새 결함과 기존 drift를 혼동하지 않는다.

## 후속

통합 검증에서 lockfile 형식 정리를 이번 PR에 포함할지 별도 변경으로 분리할지 결정한다.
