---
id: RETRO-0012
plan: plan3-protected-private-brain
date: 2026-08-20
phase: phase-04
status: 해결
category: 결함
promotion: 배포 회귀 검사
---

# mock renderer가 Quartz output 초기화를 놓침

## 관찰

실제 보호 Quartz 빌드는 output mount 지점을 초기화하려다 권한 오류로 중단됐다.

## 원인

Quartz는 output 디렉터리를 지운 뒤 다시 만들지만 mock renderer는 기존 디렉터리에 파일만 써서 이 동작을 재현하지 않았다.

## 영향

첫 release와 컨테이너 전환 전 실패해 운영 화면과 private 데이터에는 영향이 없었다.

## 대응

빌드 컨테이너에는 release 상위 디렉터리를 mount하고 Quartz output은 그 아래 staging 디렉터리로 지정했다.
회귀 검사에는 고정 Node 이미지로 실제 Quartz를 실행하는 smoke 검사를 추가했다.

## 검증

고정 Node 실제 Quartz smoke가 staging 디렉터리를 지운 뒤 다시 만들고 211개 파일을 출력했다.
운영 첫 빌드도 같은 방식으로 231개 파일을 만든 뒤 release를 활성화했다.
고의 실패 뒤에는 `current`, release 개수, 서비스 응답과 staging 0개가 그대로 유지됐다.

## 배운 점

mock은 입력과 검증 경계를 빠르게 확인하지만 외부 도구의 디렉터리 생명 주기까지 대신 증명하지 못한다.

## 후속

외부 빌더 lifecycle에 의존하는 배포 검사는 mock과 실제 고정 runtime smoke를 함께 둔다.
