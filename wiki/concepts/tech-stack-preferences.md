---
type: concept
created: 2026-05-28
updated: 2026-08-25
title: "기술 스택 선호"
description: "개인 저장소에서 반복되는 기술 선택과 저장소별로 달라지는 버전 경계"
tags: [taste, java, spring, typescript, tooling]
status: stable
---

# 기술 스택 선호

개인 저장소에서 반복되는 기술 선택이다.
특정 버전을 전역 규칙으로 고정하기보다, 반복 취향과 저장소별 pin을 구분한다.

## 반복해서 선택하는 기술

### Java와 백엔드

- 제품 백엔드는 Java와 Spring Boot를 주력으로 사용한다.
- 데이터 접근은 JPA와 QueryDSL을 선호하고 스키마 변경은 마이그레이션으로 관리한다.
- 빌드는 Gradle과 Version Catalog를 사용해 버전의 단일 원본을 둔다.
- 통합 검증에는 JUnit 5와 실제 데이터 경계에 가까운 실행 방식을 선호한다.

### TypeScript와 웹·CLI

- 개인 웹 제품은 TypeScript, Next.js와 React를 반복해 사용한다.
- JavaScript 패키지 관리는 pnpm을 선호한다.
- HTTP client는 여러 개인 저장소에서 ky를 선택한다.
- CLI는 기계가 읽을 수 있는 출력과 명시적인 종료 코드를 중요하게 본다. [[agent-friendly-cli-design]]

## 고정하지 않는 것

- Node, Next.js, React와 pnpm 버전은 저장소별 `package.json`, lockfile과 도구 pin을 따른다.
- 테스트 framework와 UI library는 제품 책임과 기존 구조에 맞춰 선택한다.
- 색상 체계와 component library를 모든 저장소에 같은 규칙으로 강제하지 않는다.
- 한 저장소의 일시적인 도구 선택을 개인 전체 취향으로 확대하지 않는다.

## 관련 개념

- [[testing-philosophy]] — 도구 이름보다 검증 경계를 우선하는 방식
- [[ai-harness-pattern]] — 저장소의 실제 규칙을 읽고 검증하는 작업 방식
- [[work-style]] — 기술 선택을 포함하는 전체 업무 스타일

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
