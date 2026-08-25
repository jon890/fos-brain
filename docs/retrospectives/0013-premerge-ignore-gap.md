---
id: RETRO-0013
plan: plan3-protected-private-brain
date: 2026-08-20
phase: phase-04
status: 해결
category: 프로세스
promotion: 배포 순서 계약
---

# merge 전 배포가 새 산출물을 untracked로 만듦

## 관찰

첫 보호 release는 성공했지만 다음 동기화의 clean checkout 검사가 새 산출물을 untracked로 판단했다.

## 원인

운영 서버 `main`에는 plan branch의 `quartz-protected/` ignore 규칙이 아직 merge되지 않은 상태에서 release를 먼저 만들었다.

## 영향

release 활성화 뒤 `brain-web` 전환 전에 다음 동기화만 차단됐고 기존 public 화면은 유지됐다.

## 대응

서버의 기존 `.git/info/exclude`를 mode 700 백업에 보존했다.
그 뒤 anchored `/quartz-protected/` 한 줄만 추가해 plan merge 전까지 tracked `.gitignore`와 같은 경계를 적용했다.

## 검증

`git check-ignore -v`가 local exclude의 정확한 한 줄을 가리키고 wildcard 규칙이 없음을 확인했다.
public checkout은 clean `main`과 `origin/main`의 같은 commit을 유지했고 기존 release와 `current`도 보존됐다.
이후 동기화 두 건이 연속으로 성공했다.

## 배운 점

새 ignore 규칙에 의존하는 산출물은 해당 규칙이 운영 branch에 도달했는지 먼저 확인해야 한다.

## 후속

tracked `.gitignore`가 merge되기 전 운영 배포에서는 같은 규칙을 local exclude에 임시로 적용한다.
