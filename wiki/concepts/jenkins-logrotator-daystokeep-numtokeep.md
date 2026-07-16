---
type: concept
created: 2026-07-01
updated: 2026-07-01
---

# Jenkins LogRotator — daysToKeep 는 일수, numToKeep 는 개수 (오해하기 쉬운 조합)

`daysToKeep` 는 "일수" 보관 기준이고 `numToKeep=-1` 은 "개수 무제한"이라, 트리거가 잦은 job 은 `daysToKeep` 만 설정해도 짧은 기간에 수천 개가 쌓여 디스크를 채울 수 있다.

## 핵심 포인트

- `daysToKeep=30` 은 "빌드 30개 보관"이 아니라 "30일간 보관" — 이름 때문에 개수로 오해하기 쉽다.
- `numToKeep=-1` 은 개수 제한이 없다는 뜻이다. `daysToKeep` 만 있고 `numToKeep` 이 `-1` 이면, 트리거 빈도가 높은 job 은 30일 안에도 수천 개가 쌓인다.
- 실측 사례: hourly/webhook 성 job(하루 약 230회 트리거)이 `daysToKeep=30`, `numToKeep=-1` 상태로 34일간 7,900개 빌드·299G 를 축적했다.
- 재발 방지에는 `daysToKeep` 과 별개로 `numToKeep` 에 명시적 개수 상한을 신설해야 한다 — 근본 원인은 "일수 제한만 있고 개수 제한이 없는 조합"이다.

## 설정 반영 함정

- `config.xml` 을 직접 수정해도 즉시 반영되지 않는다 — Jenkins 가 메모리에 옛 설정을 들고 있다.
- "Reload Configuration from Disk" 로 재적재해야 실제 적용된다.
- Reload 는 진행 중인 빌드에 영향이 없다(설정만 재적재) — Restart·Safe Restart 와 달리 빌드를 중단시키지 않는다.

## Sources

- 원본: work 네임스페이스에서 이관 (일반화)
