---
type: concept
created: 2026-06-12
updated: 2026-06-12
---

# SkillOpt — 스킬 문서를 신경망 가중치처럼 학습

Microsoft 가 공개한, 타깃 모델은 frozen 으로 두고 별도 옵티마이저 모델이 스킬 문서(SKILL.md) 한 장만 머신러닝 학습 루프로 최적화하는 방법이다.

## 핵심 포인트

- 학습 대상은 모델 가중치가 아니라 스킬 문서 텍스트 한 장이다.
  - 산출물은 `best_skill.md`(보통 300~2000 토큰) 한 장이며, 추론 시점 추가 모델 호출은 0회다.
- 학습 루프 4단계
  - Rollout — 과제 실행·채점
  - Reflect — 성공·실패 배치 분석
  - Edit — add/delete/replace 편집 제안
  - Gate — held-out 점수가 엄격히 오를 때만 채택
- 안정화 4장치가 각각 가중치 학습의 대응물을 갖는다
  - 편집 예산 제한 = learning rate (통째 재작성 같은 파괴적 변경을 막는다)
  - validation gate = early stopping
  - 거부 편집 버퍼 = momentum·history
  - epoch 단위 meta 업데이트 = slow weights
- SkillOpt-Sleep — 코딩 에이전트용 야간 정리 사이클
  - 세션 기록 채굴 → 오프라인 재실행 → 게이트 통과 편집만 staging → 사람이 채택
  - Claude Code `/sleep` 플러그인을 공식 제공한다

> 성능 수치(7모델 × 6벤치 × 3환경 52조합 전부 1위, 무스킬 대비 +19~25점)는 README 주장이며 직접 재현하지 않았다.

## 관련 개념

- [[self-improving-harness]] — SkillOpt 는 이 수동 메타 피드백 루프를 형식화·자동화한 버전이다
- [[skill-auto-optimization-prerequisites]] — 적용 전제(reward·held-out)
- [[two-tier-reward-static-llm-judge]] — reward 함수 설계
- [[reward-detector-false-positive]] — reward detector 신뢰성

## Sources

- [[../../raw/notes/2026-06-12-skillopt-sessions.md]]
