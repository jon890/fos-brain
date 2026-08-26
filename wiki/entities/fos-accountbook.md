---
type: entity
created: 2026-05-28
updated: 2026-08-25
title: "fos-accountbook"
description: "가족용 가계부 웹 제품과 금융 화면 입력 자동화의 책임 경계"
tags: [personal-system, accountbook, web, automation]
status: stable
---

# fos-accountbook

가족이 함께 쓰는 가계부 웹 제품이다.
프론트엔드와 Java 백엔드는 별도 저장소로 운영하고, [[fos-agents]]의 accountbook 워크스페이스가 금융 화면 입력을 자동화한다.

## 제품 경계

- 프론트엔드는 Next.js와 React 기반 사용자 화면, 인증과 서버 API 연결을 담당한다.
- 백엔드는 [[fos-accountbook-backend]]에서 거래, 인증과 데이터 정합성을 담당한다.
- JavaScript 패키지는 pnpm으로 관리하고 HTTP client는 ky를 사용한다.
- 화면과 API의 세부 버전은 각 저장소의 pin을 단일 원본으로 둔다.

## 금융 화면 입력 자동화

- vision 지원 에이전트는 화면에서 거래 후보와 근거를 추출한다.
- 결정적 검사는 스키마, 날짜, 금액, 일별 합계, 화면 잘림과 중복을 검증한다.
- 대화형 실행은 사용자가 승인한 후보만 등록한다.
- 주간 실행은 합계, 필드 신뢰도, 원본 생성 시각과 중복 검사를 모두 통과한 후보만 자동 등록한다.
- 전송 결과가 불명확하거나 안전 정책을 벗어난 후보는 자동 재전송하지 않고 검토 상태로 분리한다.
- 실제 금융 데이터, 인증 값과 원본 화면은 공개 저장소와 brain public에 남기지 않는다.

## 보여주는 스타일

- [[testing-philosophy]] — 비결정적 추출과 결정적 검증을 분리한다.
- [[ai-harness-pattern]] — 승인 경계와 실패 시 상태 불변을 유지한다.
- [[tech-stack-preferences]] — Java·Spring과 TypeScript 웹 제품 선택을 함께 보여준다.
- [[work-style]] — 문서, 결정과 실제 경로 검증을 연결한다.

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
