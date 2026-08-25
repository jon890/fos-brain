---
id: RETRO-0011
plan: plan3-protected-private-brain
date: 2026-08-20
phase: phase-04
status: 해결
category: 결함
promotion: docs/data-schema.md
---

# 동기화 잠금이 checkout을 스스로 dirty하게 만듦

## 관찰

첫 보호 동기화가 release를 만들기 전에 public checkout이 clean하지 않다는 오류로 중단됐다.

## 원인

`BRAIN_SYNC_LOCK`이 public checkout 안을 가리켜 동기화가 잠금을 만든 직후 자신의 clean 전제와 충돌했다.

## 영향

첫 보호 release와 컨테이너 전환은 시작되지 않아 운영 화면과 private 데이터에는 영향이 없었다.

## 대응

운영 `.env`의 `BRAIN_SYNC_LOCK`을 mode 700 배포 디렉터리 아래로 옮겼다.
public checkout 안에 생긴 0바이트 잠금 파일과 빈 디렉터리만 확인한 뒤 제거했다.

## 검증

잠금이 `/home/bifos/apps/fos-brain-deploy/` 아래에 생기고 동기화 뒤에도 public checkout이 clean 상태를 유지함을 확인했다.
첫 동기화와 동시에 요청한 동기화 두 건이 모두 성공했다.

## 배운 점

clean 검사를 수행하는 작업의 runtime 파일은 검사 대상 트리 밖에 두어야 한다.

## 후속

runtime lock과 state는 관리 대상 checkout 안에 두지 않는 계약을 배포 설정과 데이터 스키마에 고정한다.
