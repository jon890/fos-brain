---
id: RETRO-0007
plan: plan2-cloudflare-access-home-server
date: 2026-08-18
phase: phase-03
status: 해결
category: 계획
promotion: DNS 전환 격리 절차
---

# Pending 영역에서 Access 애플리케이션 생성이 거부됨

## 관찰

Cloudflare의 계정·영역 API가 Pending full zone의 self-hosted Access 애플리케이션 생성을 모두 오류 12130으로 거부했다.
이메일 일회용 PIN과 재사용 가능한 허용 정책은 같은 상태에서도 저장할 수 있었다.

## 원인

Access 애플리케이션 생성은 대상 도메인이 활성 Cloudflare 영역에 속하는지 검사한다.
네임서버를 바꾸기 전의 full zone은 소유 확인이 끝나지 않아 이 검사를 통과하지 못한다.

## 영향

Access 애플리케이션을 네임서버 전환 전에 만들어 검증한다는 기존 순서는 실행할 수 없었다.
그대로 순서를 바꾸면 영역이 Active가 된 뒤 Access를 만들기 전까지 보호 호스트가 노출될 수 있었다.

## 대응

네임서버 전환 직전에 보호 호스트의 Tunnel ingress를 `http_status:503`으로 바꾼다.
영역이 Active가 된 뒤 Access 애플리케이션과 Jenkins 웹훅 Bypass를 만들고 저장 상태를 검증한다.
검증이 끝난 경우에만 보호 ingress를 NPM 원본으로 복구한다.

## 검증

계정·영역 API와 최소 payload에서 같은 오류가 발생하는지 확인했다.
실패한 생성 시도는 되돌렸고 Access 애플리케이션 수가 0인지 다시 확인했다.
Jenkins HMAC는 전환 전에 별도로 검증해 Bypass 생성의 선행조건을 충족했다.

## 배운 점

Pending DNS 영역에 의존하는 보안 객체는 사전 생성 가능 여부를 먼저 확인해야 한다.
활성화 뒤에만 만들 수 있다면 보호 대상의 원본을 먼저 차단해 설정 공백을 없애야 한다.
