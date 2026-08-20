---
id: RETRO-0008
plan: plan2-cloudflare-access-home-server
date: 2026-08-20
phase: phase-04
status: 해결
category: 검증
promotion: Tunnel HTTPS 원본 계약
---

# Tunnel HTTP 원본이 Force SSL 리다이렉트를 반복함

## 관찰

권한 DNS 전환 뒤 공개 블로그가 브라우저에서 리다이렉트 횟수 초과 오류를 냈다.
첫 응답의 301만 확인한 검사에서는 이 문제를 찾지 못했다.

## 원인

방문자는 Cloudflare에 HTTPS로 요청했지만 Tunnel은 NPM의 HTTP 원본으로 전달했다.
NPM의 Force SSL 규칙은 원본 요청을 HTTP로 판단해 같은 HTTPS 주소로 계속 이동시켰다.

## 영향

Cloudflare와 원본이 각각 정상이어도 사용자는 공개 호스트의 최종 페이지에 도달하지 못했다.
보호 호스트도 같은 원본 경계를 사용하므로 설정을 그대로 두면 같은 문제가 생길 수 있었다.

## 대응

기존 NPM 인증서와 일치하는 호스트 이름을 SNI로 지정하고 Tunnel 원본 7개를 HTTPS로 바꿨다.
`brain`에는 호스트 이름과 일치하는 인증서를 발급한 뒤 같은 HTTPS 원본 계약을 적용했다.
각 항목의 원래 Host 헤더는 유지했고 인증서 검증을 끄지 않았다.

## 검증

공개 호스트 네 개는 리다이렉트를 최종 응답까지 따라가 반복이 없는지 확인했다.
보호 호스트 네 개는 인증하지 않은 요청이 Access 로그인으로 이동하는지 확인했다.
`brain`은 내부 SNI와 Host 요청에서 200과 배포 산출물 해시 일치를 확인했다.

## 배운 점

Cloudflare와 NPM 사이의 원본 프로토콜은 방문자 프로토콜과 NPM의 리다이렉트 판단을 함께 만족해야 한다.
리다이렉트가 있는 서비스는 첫 응답 코드가 아니라 제한된 횟수 안에 도달한 최종 응답까지 검사해야 한다.
