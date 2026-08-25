---
id: RETRO-0010
plan: plan3-protected-private-brain
date: 2026-08-20
phase: phase-03
status: 해결
category: 결함
promotion: 배포 회귀 검사
---

# Linux fixture 산출물이 root 소유로 남음

## 관찰

보호 배포 fixture는 기능 검사를 통과했지만 Linux 홈서버에서 임시 출력 정리에 실패했다.

## 원인

Docker 안에서 실행한 동시 동기화 fixture가 host UID와 GID를 전달하지 않아 bind mount 산출물을 root 소유로 만들었다.

## 영향

테스트가 성공 결과를 출력해도 임시 경로가 남아 다음 실행과 운영자의 정리를 방해할 수 있다.
운영 release와 private 데이터에는 영향이 없었다.

## 대응

동시 동기화 fixture 컨테이너를 host UID와 GID로 실행하도록 고쳤다.
종료 trap은 정리에 실패하면 테스트 전체를 실패로 끝내도록 바꿨다.

## 검증

로컬과 Linux 홈서버에서 전체 보호 배포 검사가 통과했다.
두 환경 모두 검사 종료 뒤 `.tmp-protected-deploy.*` 경로가 0개임을 확인했다.

## 배운 점

bind mount를 쓰는 fixture는 기능 assertion뿐 아니라 host 파일 소유권과 종료 뒤 잔여물까지 검증해야 한다.

## 후속

`verify-protected-deploy.sh`의 컨테이너 사용자를 host UID와 GID로 맞추고 정리 실패를 검사 실패로 다룬다.
