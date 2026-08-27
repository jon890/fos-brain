---
id: RETRO-0015
plan: plan7-brain-grounded-qa
date: 2026-08-27
phase: review
status: 해결
category: 결함
promotion: 승격 안 함
---

# 질문 데이터 수명과 모델 입력 경계를 따로 검증하지 못함

## 관찰

독립 코드 리뷰에서 질문 패널을 닫은 뒤 closure에 질문이 남고, qmd slug가 모델 근거 구분자를 깨뜨릴 수 있으며, 느린 요청 본문이 단일 실행 잠금을 먼저 차지하는 문제를 찾았다.

## 원인

DOM과 저장소의 비저장 여부는 검사했지만 closure 수명, 모델 입력 직렬화와 요청 본문 단계의 동시성은 별도 경계로 검사하지 않았다.

## 영향

질문이 화면에서 사라져도 브라우저 메모리에 남을 수 있고, 비정상 파일명이 근거 구분을 흐릴 수 있다. 느린 클라이언트는 실제 검색 전에 질문 처리 슬롯을 점유할 수 있다.

## 대응

질문 패널을 닫거나 SPA 정리 함수가 실행될 때 질문 closure를 함께 비우도록 수정했다.
브라우저 회귀 검사는 닫은 뒤 retry 버튼을 직접 눌러도 이전 질문이 복원되지 않고 새 요청도 나가지 않는지 확인한다.

qmd slug는 모델 근거 태그의 attribute에 넣기 전에 XML 특수문자와 제어 문자를 escape한다.
`%22`, `%3C`, 개행과 control 문자가 섞인 slug 회귀 검사를 추가했다.

서버는 요청 본문을 읽고 질문 형식을 검증한 뒤에만 단일 처리 잠금을 잡는다.
잠금은 요청 식별자가 일치할 때만 해제해 다른 진행 중인 요청을 지우지 않는다.
요청 본문 읽기 timeout도 추가했다.

Responses 요청에는 `max_output_tokens`를 보낸다.
모델 응답 본문과 최종 답변 문자열에도 상한을 두고 API 문서에 같은 제한값을 기록했다.

## 검증

- `node --test services/brain-ask/brainAsk.test.mjs`
  - 질문 closure와 별개로 서버 body timeout, 잠금 순서, 특수문자 slug escaping, 모델 요청과 응답 크기 제한을 검사한다.
- `quartz/scripts/verify-memory-atlas-browser.sh`
  - 질문 패널 닫기 뒤 retry가 이전 질문을 재사용하지 않는지 검사한다.

## 배운 점

비저장 계약은 storage API뿐 아니라 closure와 요청 수명까지 포함해 검증해야 한다.
모델 입력은 XML처럼 보이는 문자열을 만들 때에도 외부 입력을 그대로 attribute에 넣지 않아야 한다.
단일 처리 잠금은 실제 작업 구간만 감싸야 느린 클라이언트가 처리 슬롯을 선점하지 않는다.

## 후속

운영 배포 뒤 실제 보호 URL에서도 질문 패널 닫기, 검색 결과 선택, 모델 timeout 표시를 한 번 더 확인한다.
