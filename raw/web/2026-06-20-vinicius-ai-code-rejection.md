---
source_type: web
source_url: https://vinibrasil.com/when-i-reject-ai-code-even-if-it-works/
title: "When I reject AI code even if it works"
author: "Vinicius Brasil"
published: 2026-06-20
collected: 2026-07-02
copyright_note: "요약 중심 raw. 원문 전체 재현 아님."
---

# When I reject AI code even if it works

- 원본: https://vinibrasil.com/when-i-reject-ai-code-even-if-it-works/
- 저자: Vinicius Brasil
- 게시일: 2026-06-20
- 설명: AI can make implementation cheap while making review and judgment more expensive.

## 핵심 요약

AI 코딩 도구는 구현 속도를 높이지만, 실제 병목을 리뷰와 판단으로 옮긴다.
저자는 AI가 만든 코드가 동작하더라도, 자신이 접근 방식을 충분히 이해하지 못했거나 변경량이 문제보다 크거나 불필요한 추상화를 도입하면 거절한다고 말한다.

핵심은 "코드가 동작한다"와 "좋은 해결책이다"를 분리하는 것이다.
CI가 통과하고 로컬에서 돌아가는 코드는 여전히 부적절하거나 확장하기 어렵거나 추론 비용이 큰 해결책일 수 있다.

## 주요 주장

- AI 생성 코드의 첫 번째 비용은 작성이 아니라 리뷰다.
- 큰 작업을 작은 단계로 나누고 plan mode를 써도, 스스로 충분히 사고하지 않은 변경을 리뷰할 때 인지 부하가 커진다.
- 같은 모델을 써도 첫 세션과 두 번째 세션의 차이는 모델보다 화면 뒤의 사람에게서 난다.
- 문제를 더 오래 소화한 뒤에는 에이전트가 제시한 방향에 끌려가는 대신, 더 나은 방향으로 에이전트를 이끌 수 있다.
- 엔지니어링은 단순 구현이 아니라 적절하고 확장 가능하며 설명 가능한 해결책을 고르는 일이다.

## 거절 기준

저자는 AI 코드가 동작해도 다음 경우 거절한다고 정리한다.

- 접근 방식을 자기 언어로 설명할 수 없다.
- diff가 문제보다 크다.
- 필요성이 증명되기 전에 추상화를 도입한다.
- 로컬에서는 동작하지만 시스템을 더 이해하기 어렵게 만든다.
- 자신의 이해보다 결과물을 더 신뢰하게 된다.

## brain 관점 메모

이 글은 AI 코딩 하네스에서 "생성 성공"보다 "수용 판단"이 별도 게이트여야 함을 보강한다.
자동 리뷰봇, CI, 테스트 통과는 수용 조건의 일부일 뿐이며, 최종 판단에는 사람의 설명 가능성, 변경 범위 적합성, 추상화 필요성, 장기 추론 비용이 포함되어야 한다.

## Sources

- https://vinibrasil.com/when-i-reject-ai-code-even-if-it-works/
