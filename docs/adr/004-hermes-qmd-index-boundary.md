# ADR 004: Hermes qmd 실행과 색인을 영구 데이터 경계에 둔다

## 상태

채택

## 맥락

`brain-search`는 고정 경로의 qmd를 우선 사용하고, 실행 파일이나 컬렉션이 없으면 INDEX와 `rg`로 축소 동작한다.
홈서버의 Hermes 컨테이너에는 qmd가 없어 의미 검색과 재정렬을 사용하지 못했다.
호스트에만 qmd를 설치해도 컨테이너에서 보이지 않으며, 컨테이너 기본 Node.js 26은 로컬에서 검증한 qmd 실행 환경과 다르다.

홈서버는 GPU가 없고 Hermes에 메모리 4GiB와 CPU 2개 제한이 있다.
또한 private wiki 색인과 모델 cache는 공개 저장소와 Quartz 산출물에 들어가면 안 된다.

## 결정

- Node.js 24.15.0과 qmd 2.8.3을 `/home/bifos/.hermes/qmd`에 정확한 버전으로 설치한다.
- Hermes에는 고정 wrapper만 `/root/.local/bin-pinned/qmd`로 읽기 전용 마운트한다.
- wrapper는 qmd를 UID와 GID 1000으로 실행하고 CPU 모드, 단일 임베딩 병렬성, 전용 XDG 경로를 적용한다.
- qmd는 `brain-wiki`, `brain-raw`, `brain-private` 세 컬렉션만 등록한다.
- public 또는 private `main` push로 보호 Quartz 배포가 성공한 뒤 Jenkins가 별도 단계에서 qmd를 증분 갱신한다.
- qmd 갱신 실패는 성공한 Quartz release를 되돌리지 않고 Jenkins에서 별도 실패로 드러낸다.
- qmd 네트워크 API나 MCP 서버를 만들지 않으며 색인과 cache는 Hermes 영구 데이터 경계 안에 둔다.
- 첫 설치에서는 기존 기본 임베딩 모델을 유지한다. 한국어 모델 비교는 검색 벤치마크를 갖춘 별도 결정으로 다룬다.

## 대안

### 홈서버 호스트에만 설치

Hermes가 컨테이너 안에서 실행되므로 고정 경로와 runtime을 공유하지 못해 제외했다.

### qmd 전용 sidecar와 네트워크 API

프로세스와 인증 경계가 늘고 현재 `brain-search`의 CLI 계약도 바꿔야 하므로 제외했다.

### qmd 실패 시 Quartz release 되돌리기

사람용 게시 성공과 에이전트 검색 색인 실패는 복구 단위가 다르다.
검색에는 INDEX와 `rg` 폴백도 있으므로 배포 성공을 취소하지 않는다.

### 계속 INDEX와 rg만 사용

동작은 하지만 의미가 다른 표현과 관련 문서를 찾는 품질이 낮아 홈서버 에이전트의 검색 목표를 충족하지 못한다.

## 결과

- Hermes를 다시 만들어도 qmd runtime과 색인이 유지된다.
- private 색인이 git과 공개 웹 경계 밖에 남는다.
- 초기 모델 다운로드와 임베딩에 약 2GiB 이상의 디스크와 일시적인 CPU·메모리가 필요하다.
- 실제 설치 뒤 4GiB 제한에서 OOM이나 지속적인 지연이 발생하는지 측정해야 한다.
- qmd가 고장 나도 `brain-search`는 INDEX와 `rg`로 축소 동작하며 운영자는 qmd 단계만 다시 실행할 수 있다.
