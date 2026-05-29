---
name: brain-add
description: 개인 지식 기반(brain, ~/personal/fos-brain) 에 소스를 가져와 컴파일한다. URL·유튜브·PDF·GitHub·이미지·메모·붙여넣은 텍스트를 raw/ 로 저장하고 wiki/ 의 개념 그래프에 통합(백링크·INDEX·log 갱신). "brain add", "brain 추가", "brain 에 정리", "지식 추가", "brain 에 넣어줘", "이 링크 정리해줘", "이 영상 정리", "wiki ingest", "위키 컴파일", "raw 처리해줘" 같은 요청 시 사용. 공개/개인비공개/회사 네임스페이스 선택 지원.
---

# brain-add

Karpathy 스타일 지식 기반의 ingest 단계. 소스를 brain 으로 가져와(raw 저장) wiki 개념 그래프에 통합한다.
사용자 개입형이 기본 — 핵심 요약을 먼저 보여주고 검토받은 뒤 wiki 에 반영한다.

## 대상 디렉터리

`~/personal/fos-brain` — 다른 곳에서 호출되었다면 사용자에게 확인.

## 0단계 — 네임스페이스 선택 (필수)

`AskUserQuestion` 으로 어느 brain 에 넣을지 묻는다(사용자가 이미 지정했으면 생략):

- `public` — 루트(`raw/`, `wiki/`). git commit + Quartz 공개 대상.
- `private` — `private/`. gitignore(개인 비공개).
- `work` — `work/<회사>/`. gitignore(회사 자료). **work 선택 시 회사도 함께 받는다**(현재 `nhn`). 없는 회사면 `work/<회사>/{raw,wiki}` 골격을 먼저 만든다.

이후 모든 경로의 `<ns>` 는 선택된 네임스페이스 루트다(public=루트, private=`private/`, work=`work/<회사>/`).

## 1단계 — 소스 선택 (필수)

사용자가 소스를 명시하지 않았으면 `AskUserQuestion` 으로 묻는다:

- **현재 세션에서 논의한 내용** — `/brain-add` 를 호출하면 지금까지의 대화·결정·분석을 소스로 삼아 정리한다. 사용자가 명시 호출하면 이 옵션을 기본으로.
- obsidian 최근 메모(`~/personal/obsidian/YYYY년 메모/` 의 최근 변경분)
- 특정 경로(로컬 파일·디렉터리)
- URL(웹 기사)
- 유튜브 링크
- 붙여넣은 텍스트

세션 논의 내용을 등록할 때는 결론·결정·근거를 정리해 `<ns>/raw/notes/` 에 대화 요약으로 저장한 뒤 wiki 로 컴파일한다(원문 대화 전체가 아니라 재사용 가치 있는 핵심만).

**한 번에 raw 전체를 처리하지 않는다** — 점진적 컴파일 원칙.

## 2단계 — 소스 획득 및 raw 저장

소스 종류별로 처리해 `<ns>/raw/<카테고리>/` 에 markdown 으로 저장한다.

| 소스 | 처리 | 저장 위치 |
| --- | --- | --- |
| 웹 기사·페이지 | WebFetch → markdown 본문 | `<ns>/raw/web/` |
| 유튜브 링크 | 아래 "유튜브 처리" | `<ns>/raw/videos/` |
| PDF 논문 | Read 로 파싱(원본 PDF 도 복사) | `<ns>/raw/papers/` |
| GitHub repo | `gh`/clone 로 README·핵심 코드 | `<ns>/raw/repos/` |
| 이미지 | Read 로 시각 분석 → 설명 텍스트 | `<ns>/raw/notes/` |
| obsidian 메모 | 원본 복사(원본은 obsidian 에 그대로 둠) | `<ns>/raw/notes/` |
| 붙여넣은 텍스트 | 그대로 저장 | `<ns>/raw/notes/` |

raw 파일 상단에 출처 메타(원본 URL·수집일·소스 종류)를 frontmatter 로 기록한다.

### 유튜브 처리

영상·음성을 직접 듣지 못하므로 자막을 경유한다. **현재는 자막 있는 영상만 우선 지원**한다.

1. 메타 추출:
   `yt-dlp --skip-download --print "%(title)s | %(channel)s | %(upload_date)s" <URL>`
2. 자막 추출(한국어 우선, 없으면 영어, 자동자막 허용):
   `yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs "ko,en" --sub-format vtt -o "<ns>/raw/videos/%(id)s.%(ext)s" <URL>`
3. vtt → 평문 텍스트로 정리(타임스탬프·중복 라인 제거)해 raw markdown 작성.
4. 자막이 전혀 없으면 사용자에게 알린다 — (a) 제목·설명 + WebSearch 보강, (b) whisper 설치 후 STT(미설치, 나중에) 중 선택.
5. 자동자막 기반이면 raw 와 wiki 양쪽에 "자동자막 기반(오인식 가능)" 을 표기.

## 3단계 — 현황 파악

- `<ns>/wiki/INDEX.md` 읽기 — 기존 concept·topic·entity 목록 확인.
- 방금 저장한 raw 파일 정독.

## 4단계 — 개념 추출 및 cross-reference 탐색

- raw 에서 별도 페이지로 다룰 개념을 선정(개수 제한 없음).
- **Karpathy 원칙**: 한 소스 ingest 는 흔히 10개 이상 wiki 페이지에 영향. INDEX 의 기존 페이지를 훑어 보강·교차 참조 후보를 찾는다.
- 기존 페이지와 겹치면 **새로 만들지 말고 보강**.

## 4.5단계 — 검증 게이트 (필수, 쓰레기·오지식 유입 차단)

추출한 각 지식 후보를 두 축으로 판정한 뒤, 판정을 미리보기에 함께 제시한다.

**축 1 — brain 적합성 (넣을 곳이 여기 맞나?)**

- 넣기: 재사용 가치 있는 **결정·근거·패턴·맥락·gotcha**, 코드로 자명하지 않은 "왜".
- 빼기 (다른 곳으로 라우팅):
  - 실행 절차 → skill
  - 행동 규칙 → CLAUDE.md
  - 코드·git 으로 자명한 것(파일 구조, 변경 이력) → 넣지 않음
  - 일시적·세션 한정 상태 → 넣지 않음
  - 이미 brain 에 있음 → 새로 만들지 말고 기존 페이지 보강

**축 2 — 정확성·신뢰도**

- 출처 있는 사실인가, 추측인가 → 추측이면 "미검증" 표기하거나 보류.
- 사용자 정정 여지 큰 주관 판단인가 → 확인을 요청한다.
- 2차 출처(자동자막·에이전트 생성물 등)면 신뢰도를 표기한다.

판정 결과를 항목별로 분류해 둔다: `넣자(이유) / skill·CLAUDE 로 / 자명해서 제외 / 중복 보강 / 미검증 확인 필요`.

**출처별 공개 기본값 (네임스페이스 과잉 플래그 방지)**

- **fos-study 출처는 public-OK 가 기본.** fos-study 콘텐츠는 `blog-post-writer` 스킬이 민감정보를 제거해 외부 공개용으로 이미 검증한 자료다(회사명·내부 URL → 일반화). 본문에 회사·제품명이 보여도 이미 공개 수준이면 work 로 과잉 분류하지 않는다.
- 그 외 출처(사내 레포·내부 문서·미검증 대화)는 회사 운영 세부가 있으면 work, 개인 비공개면 private 로.
- 애매하면 보수적으로 비공개 쪽 + 사용자 확인.

## 5단계 — 핵심 요약 미리보기 (사용자 개입)

wiki 에 쓰기 전에 채팅 본문에 인라인으로 보여준다:

- 추출한 핵심 요약
- 4.5단계 **검증 게이트 판정** (넣을 항목 / 제외 항목 + 이유 / 미검증 항목)
- 만들·보강할 페이지 목록
- 연결할 백링크

검증 게이트에서 갈린 항목·결정은 평문이 아니라 **`AskUserQuestion`** 으로 묻는다.
사용자 검토·승인을 받은 뒤 6단계로 진행한다.

## 6단계 — 페이지 작성·갱신

- 새 concept: `<ns>/wiki/concepts/<kebab-case>.md` (CLAUDE.md 스키마)
- 개체(사람·프로젝트·목표): `<ns>/wiki/entities/<kebab-case>.md`
- 보강: 기존 페이지 하단 `## 추가 (YYYY-MM-DD)` 로 append, Sources 갱신
- 모든 페이지에 양방향 백링크
- **링크 방향 규칙**: 공개(public) 페이지는 private·work 를 링크하지 않는다. 비공개 → 공개는 허용.

## 6.5단계 — 가독성 검증 (필수)

페이지를 쓴 직후 가독성 규칙(전역 CLAUDE.md)을 검증하고, 위반은 즉시 고친 뒤 다음 단계로 간다.

- **자동 검사**: 방금 쓴·보강한 파일에 검사 스크립트를 돌린다.
  - `python3 scripts/brain-readability.py <파일경로...>`
  - 점검: 인라인 연결(` + `/` · `/` & `), 콤마 5+ 나열, `~` 취소선 함정, `§` 기호.
- **수동 점검**(스크립트가 못 잡는 것):
  - paragraph 평문 문장이 명사형으로 끝나는가(예: "필요.", "불변.") → 동사 종결로.
  - 한 bullet 에 정보가 3개 이상 압축됐는가 → sub-bullet 분리.
- **false positive 판단**: 인라인 `+` 가 제목·고유명(`React Hook Form + Zod`)·plus 의미(`200 + 에러 코드`)면 그대로 둔다. 구분 항목을 묶은 것이면 콤마·sub-bullet 으로 고친다.
- 위반을 고친 뒤 7단계로 진행한다.

## 7단계 — INDEX 갱신

- 새 페이지 등록, 한 줄 요약 갱신
- "마지막 brain-add" 메타에 오늘 날짜
- public 네임스페이스면 검색 인덱스 갱신: `qmd update && qmd embed`

## 8단계 — log append (필수)

`<ns>/wiki/log.md` 하단에:

```
## [YYYY-MM-DD] add | <한 줄 설명>
- Source: <처리한 raw 경로 / 원본 URL>
- 신규 N 페이지, 보강 M 페이지
```

## 9단계 — 요약 보고

만든/보강한/건너뛴 페이지를 표로 보고. 건너뛴 개념은 이유 명시.

## 금지

- raw 파일 수정·삭제
- 공개 페이지에서 private·work 링크
- `.gitignore` 수정해 비공개를 공개로 전환
- 출처 없는 주장
- 한 번에 raw 전체 훑기
