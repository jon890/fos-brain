# ADR-010: 단일 Brain 화면은 로컬 관리자 session으로 private 조회를 허용한다

- 상태: 채택
- 날짜: 2026-09-03

## 맥락

Brain 전체를 외부 인증 계층 뒤에 두면 public 지식도 로그인해야 한다.
사이트를 public과 private 주소로 나누면 같은 관계 지도에서 지식을 탐색하려는 사용자 흐름이 끊긴다.
Quartz는 정적 사이트이므로 화면에서 private 항목을 숨기는 것만으로는 콘텐츠 색인과 본문 접근을 차단할 수 없다.

## 결정

- 하나의 주소와 UI에서 비로그인 사용자는 public만, 관리자는 public과 private를 조회한다.
- NestJS BFF가 로컬 관리자 비밀번호를 검증하고 서버 메모리의 opaque session으로 `admin` 역할을 판정한다.
- private 본문과 관계 데이터는 서버가 관리자 session을 확인한 뒤에만 보낸다.
- public 정적 산출물과 private 포함 산출물은 배포 내부에서 분리한다.
- 외부 reverse proxy와 tunnel은 전송 경로일 뿐 인증의 필수 조건으로 사용하지 않는다.

## 검토한 대안

- 전체 사이트를 Cloudflare Access로 보호하는 방식은 public 자료까지 로그인을 요구하므로 제외했다.
- public과 private를 다른 주소로 제공하는 방식은 하나의 관계 지도라는 사용자 경험과 맞지 않아 제외했다.
- 병합 산출물을 브라우저에 보내고 UI만 숨기는 방식은 private 본문과 메타데이터를 보호하지 못해 제외했다.
- JWT cookie는 로그아웃 직후 서버에서 폐기하기 어렵고 단일 instance에는 필요 이상이라 제외했다.
- 영구 session DB는 관리자 한 명과 재시작 시 재로그인을 허용하는 현재 범위에 비해 운영 비용이 커서 제외했다.
- OAuth와 passkey는 계정 복구와 외부 provider 구성이 추가되므로 첫 버전에서 제외했다.

## 운영 조건

- session cookie는 HTTPS에서만 전송하고 JavaScript가 읽을 수 없어야 한다.
- password hash와 운영 경로는 private 인프라 저장소와 서버 secret이 관리한다.
- 애플리케이션 인증을 검증하기 전에는 외부 인증 계층을 제거하지 않는다.
