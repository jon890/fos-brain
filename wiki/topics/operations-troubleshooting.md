---
type: topic
created: 2026-06-01
updated: 2026-08-25
title: "운영 문제 진단 방식"
description: "증상과 실제 상태를 분리하고 최소 변경과 되돌리기 근거로 복구하는 개인 운영 방식"
tags: [operations, troubleshooting, verification, work-style]
status: stable
---

# 운영 문제 진단 방식

운영 문제는 개별 명령을 외우기보다 외부 증상, 내부 상태와 변경 경계를 분리해 진단한다.
특정 제품의 우회법은 해당 저장소 문서가 관리하고, 여기에는 여러 서비스에서 반복되는 판단 방식만 남긴다.

## 진단 순서

1. 사용자에게 보이는 증상과 내부 origin 상태를 각각 측정한다.
2. DNS, proxy, application과 data처럼 계층별 상태를 한 번에 하나씩 확인한다.
3. 변경 전에 현재 설정, 해시와 실행 상태를 되돌릴 수 있는 형태로 보존한다.
4. 문제를 일으킨 최소 단위만 바꾸고 관련 없는 container와 service가 그대로인지 확인한다.
5. 내부 health가 아니라 실제 사용자 경로의 최종 응답과 리다이렉트를 검증한다.
6. 실패하면 활성 상태, 데이터와 배포 산출물이 바뀌지 않았는지 확인한다.

## 남길 위치

- 반복 가능한 운영 원칙은 [[testing-philosophy]]와 자동 검사로 남긴다.
- vendor 고유 결함과 저장소별 우회는 코드, ADR와 회고에 둔다. [[vendor-bug-wrapper-vs-replace]]
- 제거·전환 작업은 남아 있어야 하는 상태와 사라져야 하는 상태를 함께 검사한다. [[removal-plan-grep-gate]]
- 검토 제안은 적용됐다는 가정 대신 결과를 실측한다. [[review-bot-suggestion-verify]]

## 관련 Topics

- [[observability]] — 증상을 발견하고 계층별 신호를 수집하는 방법
- [[work-style]] — 최소 변경과 근거 중심 검증이 포함된 전체 업무 스타일

## Sources

- [[../../raw/notes/2026-08-25-personal-knowledge-refresh.md]]
