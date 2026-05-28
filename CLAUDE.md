# fos-brain — Claude Code 작업 규칙

이 저장소는 Karpathy 스타일 LLM 지식 기반(brain)이다.
원본(`raw/`)은 사용자가 수집하거나 brain-add 로 가져오고, 위키(`wiki/`)는 Claude Code 가 컴파일·유지한다.

범용 개인 brain 이다 — 기술 연구뿐 아니라 일지·목표·건강·취미 등 개인 지식 전반을 다룬다.

메모는 별도 공간(`~/personal/obsidian`)에서 작성하고, 그중 brain 에 통합할 가치가 있는 것만 brain-add 로 이 저장소에 가져온다.

## 네임스페이스 (공개·비공개 분리)

brain 은 세 네임스페이스로 나뉜다. 각 네임스페이스는 독립된 mini-brain(자체 `raw/` + `wiki/` + INDEX + log)이다.

| 네임스페이스 | 경로 | git | Quartz 공개 | 용도 |
| --- | --- | --- | --- | --- |
| public | 루트(`raw/`, `wiki/`) | commit | 게시 | 공개 가능한 개인 자료 |
| private | `private/` | **gitignore** | 제외 | 개인 비공개 자료 |
| work | `work/<회사>/` | **gitignore** | 제외 | 회사 자료 (회사별 분리) |

`work` 는 **회사별 서브레벨**을 둔다 — 각 회사는 `work/<회사>/{raw,wiki}` 자체 mini-brain.
현재: `work/nhn/`. 이직·복수 소속 시 `work/<회사>/` 를 추가한다.

규칙:

1. **라우팅**: brain-add 는 호출 시 네임스페이스를 선택받아 해당 트리에만 저장·컴파일한다. work 선택 시 회사(`<회사>`)도 함께 받는다.
2. **링크 방향**: 공개 페이지는 비공개(private·work)를 링크하지 않는다(공개 빌드 깨짐·유출 방지). 비공개 → 공개 링크는 허용.
3. **검색**: brain-search 는 로컬에서 세 네임스페이스를 모두 검색하되, 인용 시 출처에 네임스페이스를 표기한다.
4. **gitignore 불변**: `private/`, `work/` 를 commit 대상에 올리지 않는다. `.gitignore` 를 수정해 비공개를 공개로 바꾸지 않는다.

아래 디렉터리·스키마 설명은 한 네임스페이스 내부 구조를 가리킨다(public 기준이며 private·work 도 동일).

## 디렉터리 역할

- `raw/` — **원본**. LLM 은 읽기 전용으로 취급한다. 수정·삭제 금지(사용자 명시 지시 예외).
  - 하위 카테고리는 자유롭게 추가 가능: `web/`, `papers/`, `repos/`, `notes/`, 그리고 개인 brain 용 `journal/`, `health/`, `articles/`, `videos/` 등.
- `wiki/INDEX.md` — 전체 목차 + 한 줄 요약. 모든 brain-add / brain-lint 후 최신 상태로 유지.
- `wiki/concepts/` — 개념 단위 페이지. 백링크 의무.
- `wiki/topics/` — 여러 개념을 묶는 상위 narrative 페이지.
- `wiki/entities/` — 사람·프로젝트·목표 같은 개체 페이지(개인 brain 용).
- `wiki/log.md` — append-only 활동 연대기.

## 작업 원칙

1. **사용자 편집 최소화**: wiki 의 모든 변경은 LLM 책임. 사용자가 wiki 를 직접 고친 흔적이 보이면 덮어쓰기 전에 확인.
2. **백링크 의무**: 새 페이지를 만들면 다음을 모두 한다.
   - `INDEX.md` 에 등록
   - 관련 다른 페이지에 양방향 링크 추가
   - 어떤 `raw/` 출처에서 왔는지 페이지 하단 "Sources" 섹션에 기록
3. **raw 는 출처**: wiki 의 주장은 raw 로 추적 가능해야 한다. 출처 없는 주장 금지.
4. **점진적 컴파일**: 한 번에 raw 전체를 처리하지 않는다. 새 raw 파일 또는 사용자가 지정한 범위만 처리.
5. **lint 는 별도 호출**: 무결성 점검은 사용자가 brain-lint 를 명시 요청할 때만 실행.

## 페이지 스키마

### `wiki/concepts/<개념명>.md`

```markdown
---
type: concept
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <개념명>

한 줄 정의.

## 핵심 포인트

- ...

## 관련 개념

- [[다른-개념]] — 관계 설명

## Sources

- [[../../raw/papers/원본파일.md]]
- [[../../raw/web/기사.md]]
```

### `wiki/topics/<주제명>.md`

여러 concept 을 묶는 narrative. 같은 frontmatter + "Concepts" 섹션에 `[[concept]]` 나열.

### `wiki/entities/<개체명>.md`

사람·프로젝트·목표 등. `type: entity` frontmatter. 관련 concept·topic 과 양방향 링크.

## 워크플로우 진입점 (Skill)

전역 skill(`~/.claude/skills/`). 모든 skill 의 대상 디렉터리는 이 저장소(`~/personal/fos-brain`)다.

- `brain-add` — 소스를 가져와 `raw/` 로 저장한 뒤 `wiki/` 로 컴파일
- `brain-search` — INDEX → wiki → raw 순으로 답변, 결과는 wiki 로 환원
- `brain-lint` — 무결성 점검(백링크·고아·중복·Sources·frontmatter·INDEX 동기화·모순·교차 참조)

모든 skill 은 `wiki/log.md` 에 append-only 로 활동 기록을 남긴다.

## brain-add 가 처리하는 소스

brain-add 는 다양한 소스를 `raw/` 로 가져와 파싱한다.

| 소스 | 처리 방식 |
| --- | --- |
| 웹 기사·페이지 | WebFetch → markdown 본문 |
| 유튜브 링크 | `yt-dlp` 로 자막(자동·수동) + 메타 추출 → 텍스트 |
| PDF 논문 | Read 로 직접 파싱 |
| GitHub repo | clone / `gh` 로 README·코드 |
| 이미지 | Read 로 시각 분석 |
| 붙여넣은 텍스트·로컬 파일 | 그대로 |

유튜브는 영상·음성을 직접 듣지 못하므로 자막을 경유한다.
현재는 **자막 있는 영상만 우선 지원**한다.
자막 없는 영상의 로컬 STT(`whisper`)는 미설치 상태이며 나중에 추가한다.

## 검색 도구: qmd

규모가 커지면 `grep` 으로는 한계가 있다.
Karpathy 가 권장한 qmd(BM25 + 벡터 + LLM rerank)를 사용한다.

- 등록 컬렉션: `brain-wiki`(fos-brain/wiki), `brain-raw`(fos-brain/raw)
- 1차 검색(BM25): `qmd search "<keyword>" -c brain-wiki`
- 의미 검색(벡터): `qmd vsearch "<text>" -c brain-wiki`
- 하이브리드 + rerank(권장): `qmd query "<question>"`
- 인덱스 갱신: `qmd update`(파일 변경 후), `qmd embed`(임베딩 재생성)
- 상태 점검: `qmd status`

`brain-search` skill 은 wiki 가 일정 규모 이상이면 grep 대신 `qmd query` 를 1차 검색으로 사용한다.

## 웹 UI: Quartz

연결된 지식을 그래프로 보는 웹 UI 는 Quartz v4 정적 사이트로 구축한다(`quartz/`).
공개 빌드와 로컬 전체 빌드 두 가지를 운영한다.

### 툴체인 전제

- node 22.16.0 핀(`.tool-versions` = mise, `.npmrc` 의 `use-node-version` = pnpm). node 25 에선 tsx 가 `.scss` ESM 로딩에 실패하므로 22 유지.
- pnpm(`packageManager` 필드). `.npmrc` 에 `node-linker=hoisted`(Quartz 가 phantom 의존성을 직접 import).
- fos-brain 은 **독립 git repo** 여야 한다. 홈(`/Users/nhn`)이 `*` 화이트리스트 .gitignore 라, fos-brain 에 자체 `.git` 이 없으면 Quartz 의 `isGitIgnored` 가 모든 content 를 걸러내 입력 0 이 된다.

### 공개 빌드 (`quartz/`)

- content: `quartz/content` → 루트 `wiki/` 심볼릭 링크(public 만). private·work 는 config `ignorePatterns` 로 제외.
- 기능: 그래프 뷰 + 전문 검색 + 백링크 패널
- 서빙: `cd quartz && pnpm quartz build --serve` (기본 포트 8080)
- 외부 게시(GitHub Pages 등)는 별도 요청 시에만. raw RAG 분석 등 공개 적정성 확인 후.

### 로컬 전체 빌드 (`quartz-local/`)

- content: public + private + work 전체 그래프. 비공개 폴더는 `_private`/`_work` 로 병합(공개 config 의 ignore 회피).
- 병합 content 는 repo 밖 temp 에 생성(repo 안이면 `.gitignore` 때문에 입력이 걸러짐).
- **gitignore 대상**(`quartz-local/content`, `quartz-local/public`) — 절대 게시하지 않는다.
- 서빙: `./quartz-local/serve.sh` (포트 8081)

## Obsidian 호환

이 저장소는 순수 markdown + `[[wikilink]]` 라 Obsidian vault 로도 열 수 있다.
하지만 주 뷰어는 Quartz 웹 UI 다.
메모 작성은 별도 vault(`~/personal/obsidian`)에서 한다.

## 금지 사항

- `raw/` 파일 자동 수정·삭제
- wiki 페이지 일괄 재작성(사용자 요청 시 외)
- 출처 없는 주장 작성
- 한 번의 brain-add 에서 raw 전체를 훑기
