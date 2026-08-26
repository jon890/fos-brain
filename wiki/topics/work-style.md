---
type: topic
created: 2026-05-28
updated: 2026-08-25
title: "업무 스타일"
description: "개인 프로젝트에서 반복되는 개발, 문서, 검증과 AI 협업 방식"
tags: [work-style, ai-agent, documentation, testing]
status: stable
---

# 업무 스타일

개인 프로젝트에서 반복되는 개발, 문서와 AI 협업 방식이다.
도구 이름보다 작업을 작게 닫고, 판단 근거와 실제 동작을 남기는 규율을 중요하게 본다.

## 핵심 요약

- **AI 하네스 주도 개발**: 목표, 권한 경계, 작성·검토 분리와 완료 근거를 먼저 설계한다. [[ai-harness-pattern]]
- **결정 우선 문서화**: 되돌리기 어렵거나 대안이 갈리는 결정은 코드보다 먼저 이유를 남긴다. [[docs-first-adr]]
- **실동작 검증**: 결정적 검사, 실제 실행 경로와 실패 시 상태 불변을 확인한다. [[testing-philosophy]]
- **저장소별 기술 선택**: 반복 취향과 저장소별 버전 경계를 구분한다. [[tech-stack-preferences]]
- **학습의 단일 원본 환원**: 반복 교훈은 테스트, skill이나 AGENTS.md로 옮기고 일회성 사건은 회고에 둔다. [[self-improving-harness]]
- **정보의 탐색성**: 요약에서 전체를 훑고 필요한 원문으로 내려가는 화면을 선호한다. [[information-interface-preferences]]
- **관심사별 자동화 경계**: 공통 규칙과 민감한 실행 데이터를 분리한 개인 자동화 시스템을 운영한다. [[fos-agents]]

## 이 스타일을 보여주는 저장소

- [[dooray-cli]] — 사람과 에이전트가 함께 쓰는 CLI와 공개 하네스
- [[nhncloud-cli]] — 도구 구현보다 사용·검증 경계를 먼저 세운 CLI
- [[fos-blog]] — 콘텐츠와 배포 검증을 연결한 개인 블로그
- [[fos-accountbook]] — 웹 제품과 안전한 가계부 입력 자동화
- [[fos-accountbook-backend]] — Java와 Spring 기반 도메인·통합 검증
- [[fos-study]] — 기술 학습을 공개 글과 재사용 문서로 정리하는 저장소
- [[fos-agents]] — 개인 업무와 생활 자동화를 워크스페이스별로 격리한 모노레포

## Sources

- [[../../raw/notes/2026-05-28-repo-work-style-analysis.md]]
- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
