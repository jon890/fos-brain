---
id: RETRO-0006
plan: plan2-cloudflare-access-home-server
date: 2026-08-18
phase: phase-02
status: 해결
category: 구현
promotion: public 산출물 계약
---

# Linux에서 public 홈 파일 대소문자가 달라짐

## 관찰

public Quartz 빌드가 `INDEX.html`은 만들었지만 Linux nginx가 기대하는 `index.html`은 만들지 않아 홈 경로가 정상 응답하지 않았다.

## 원인

개발 환경의 대소문자를 구분하지 않는 파일 시스템에서는 두 이름이 같은 파일처럼 보여 Linux 배포 산출물 계약을 검증하지 못했다.

## 영향

빌드와 nginx 설정 검사는 통과하지만 배포 컨테이너의 루트 경로는 정상 페이지를 제공하지 못했다.

## 대응

빌드 후 `INDEX.html`이 있고 `index.html`이 없으면 소문자 이름으로 복사한다.
최종 `index.html`이 없거나 비어 있으면 빌드를 실패로 끝낸다.

## 검증

Linux 컨테이너에서 합성 `INDEX.html`만 두고 정규화를 실행해 소문자 `index.html`이 생기고 비어 있지 않음을 확인했다.
이 검사를 public 배포 회귀 검사에 포함했다.

## 배운 점

정적 사이트의 홈 문서 이름은 로컬 파일 시스템이 아니라 배포 대상 Linux 환경에서 검증해야 한다.
