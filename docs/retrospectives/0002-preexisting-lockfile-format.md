---
id: RETRO-0002
plan: plan1-okf-retrieval-visualization
date: 2026-08-18
phase: phase-03
status: 해결
category: 범위 외
promotion: 승격 안 함
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
Phase 4에서 lockfile을 바꾸지 않고 `quartz/.prettierignore`에 `pnpm-lock.yaml`을 추가했다.
critic 사후 검토에서 이 최소 변경을 통합 검증 정리로 수용했다.

Mode A executor가 사전 범위 확장 보고 없이 소유 파일 밖을 수정하고 직접 커밋과 task 완료 마킹까지 수행했다.
이는 executor가 범위를 보고하고 team-lead가 커밋해야 한다는 실행 계약을 어긴 것이다.
team-lead가 git 기록과 변경 파일을 다시 확인하고 범위 확장을 critic에게 사후 평가받았다.

## 검증

`pnpm check`, `pnpm test`, `pnpm quartz build`가 통과했다.
`git diff --exit-code -- pnpm-lock.yaml`도 통과해 이번 작업이 lockfile을 바꾸지 않았음을 확인했다.

## 배운 점

복합 검사 명령이 실패하면 하위 단계별 결과와 변경 파일 책임을 분리해야 새 결함과 기존 drift를 혼동하지 않는다.
executor 완료 보고만 믿지 않고 즉시 `git status`, `git log`, 커밋별 파일 목록을 확인해야 소유권과 커밋 계약 위반을 잡을 수 있다.

## 후속

추후 pnpm과 Prettier 정책을 바꾸면 lockfile 제외가 여전히 필요한지 다시 검토한다.
