---
id: RETRO-0005
plan: plan2-cloudflare-access-home-server
date: 2026-08-18
phase: phase-01
status: 해결
category: 구현
promotion: 배포 회귀 검사
---

# 컨테이너 패키지 캐시가 저장소에 남음

## 관찰

public Quartz 빌드 컨테이너가 bind mount한 `quartz/` 아래에 `.pnpm-store/`를 만들었다.

## 원인

패키지 저장소 경로를 지정하지 않아 pnpm이 쓰기 가능한 프로젝트 경로를 캐시 위치로 선택했다.

## 영향

빌드는 성공하지만 홈서버 checkout에 추적하지 않는 캐시가 남고 반복 실행 때 저장소 상태가 달라진다.

## 대응

빌더가 pnpm store를 컨테이너의 `/tmp/pnpm-store`로 지정하게 했다.
검증 스크립트는 빌드 뒤 저장소 내부에 `.pnpm-store`가 생기면 실패한다.

## 검증

배포 검증을 다시 실행해 public Quartz 빌드가 성공하고 저장소 내부 캐시가 생성되지 않음을 확인했다.

## 배운 점

bind mount에서 패키지 관리자를 실행할 때는 의존성 캐시 위치를 컨테이너 임시 영역으로 명시하고 저장소 오염을 회귀 검사해야 한다.
