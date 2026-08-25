---
id: RETRO-0009
plan: plan2-cloudflare-access-home-server
date: 2026-08-20
phase: phase-04
status: 해결
category: 검토
promotion: public 배포 누출 검사
---

# 같은 디렉터리 상대 private URL을 누출 검사에서 놓침

## 관찰

public 배포 검사는 `/private`와 `../private` URL을 거부하지만 `private/...` 형태는 검사하지 않았다.

## 원인

정규식이 루트 절대 경로와 상위 디렉터리 상대 경로만 열거했다.
같은 디렉터리에서 시작하는 상대 URL을 별도 경계로 다루지 않았다.

## 영향

생성된 HTML에 같은 디렉터리 상대 private 링크가 들어가도 public-only 검증이 성공할 수 있다.

## 대응

private URL 정규식이 따옴표 바로 뒤의 `private/`와 슬래시 뒤의 `private/`를 모두 찾게 했다.
같은 검사 함수를 합성 fixture와 실제 public 산출물에 함께 사용한다.

## 검증

`/private/...`, `../private/...`, `private/...` 세 fixture가 모두 거부 대상인지 확인했다.
`bash -n`, `shellcheck`, 실제 public Quartz 빌드를 포함한 배포 검사가 통과했다.

## 배운 점

URL 누출 검사는 경로가 시작하는 위치와 모든 디렉터리 경계를 함께 다뤄야 한다.
검사 정규식에는 놓치기 쉬운 경계별 합성 fixture를 같은 실행 경로로 연결해야 한다.
