# fos-brain

이 저장소는 Karpathy 스타일 LLM 지식 기반(brain)이다.
원본(`raw/`)은 사용자가 수집하거나 brain-add 로 가져오고, 위키(`wiki/`)는 Claude Code 가 컴파일·유지한다.

범용 개인 brain이다. 기술 연구뿐 아니라 일지·목표·건강·취미 등 개인 지식 전반을 다룬다.

## 네임스페이스 (공개·비공개 분리)

brain 은 두 네임스페이스로 나뉜다. 각 네임스페이스는 자체 `raw/`, `wiki/`, INDEX, log 를 갖는 독립된 mini-brain 이다.


| 네임스페이스  | 경로                  | git           | Quartz 공개 | 용도           |
| ------- | ------------------- | ------------- | --------- | ------------ |
| public  | 루트(`raw/`, `wiki/`) | commit        | 게시        | 공개 가능한 개인 자료 |
| private | `private/`          | **gitignore** | 제외        | 개인 비공개 자료    |


회사·팀 지식(사내 시스템 조회법, 업무 기록 등)은 이 brain의 대상이 아니다. `nbrain`(Dooray 위키 기반 사내 지식 검색)으로 관리한다.

규칙:

1. **라우팅**: brain-add 는 호출 시 네임스페이스를 선택받아 해당 트리에만 저장·컴파일한다.
2. **링크 방향**: 공개 페이지는 비공개(private)를 링크하지 않는다(공개 빌드 깨짐·유출 방지). 비공개 → 공개 링크는 허용.
3. **검색**: brain-search 는 로컬에서 두 네임스페이스를 모두 검색하되, 인용 시 출처에 네임스페이스를 표기한다.
4. **gitignore 불변**: `private/` 를 commit 대상에 올리지 않는다. `.gitignore` 를 수정해 비공개를 공개로 바꾸지 않는다.
5. **네임스페이스 간 매핑**(비공개 ↔ 공개 지식 연결): 비공개 → 공개 방향만 건다.
  - 비공개 페이지에서 **bare-slug** `[[개념명]]` 으로 공개 개념을 가리킨다(경로 없이). 병합 빌드에서 slug 로 해석된다.
  - 이 cross-link 는 **로컬 전체 그래프(`quartz-local`)에서만** 렌더된다. 공개 빌드(`quartz`)엔 비공개 노드가 없어 보이지 않는다(개인 비공개 유지).
  - 반대(공개 → 비공개)는 금지(규칙 2).

### 형상관리 (네임스페이스별 독립 VC)

각 네임스페이스는 **독립된 git repo** 로 버전관리한다. 공개 repo 가 `private/` 를 gitignore 하므로 중첩 독립 repo 라도 서로 섞이지 않는다(submodule 포인터·URL 노출 없음).


| 네임스페이스  | git repo                                        | 비고                          |
| ------- | ----------------------------------------------- | --------------------------- |
| public  | `github.com/jon890/fos-brain` (PUBLIC)          | 루트 repo                     |
| private | `github.com/jon890/fos-brain-private` (PRIVATE) | `private/` 안 중첩 `.git`, SSH |


불변 규칙:

- private repo 는 **PRIVATE visibility** 유지(개인 커리어·건강·투자 포함).
- 개인 repo 생성은 반드시 `github.com`(개인 계정) 또는 로컬에. 회사 GitHub Enterprise 에 개인 brain 을 올리지 않는다.

아래 디렉터리·스키마 설명은 한 네임스페이스 내부 구조를 가리킨다(public 기준이며 private 도 동일).

## 디렉터리 역할

- `raw/` — **원본**. LLM 은 읽기 전용으로 취급한다. 수정·삭제 금지(사용자 명시 지시 예외).
- `wiki/INDEX.md` — 전체 목차와 한 줄 요약. 모든 brain-add / brain-lint 후 최신 상태로 유지.
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
3. **wikilink 는 bare-slug 로 작성 (필수)**: 다른 wiki 페이지를 가리킬 땐 경로 없이 파일명만 쓴다.
  - O: `[[work-style]]` · `[[ai-harness-pattern]]`
  - X: `[[topics/work-style]]` · `[[../concepts/ai-harness-pattern]]` (경로형 금지)
  - 이유: 로컬 전체 빌드(`quartz-local`)는 네임스페이스를 하위 폴더(`public/`·`_private/`)로 병합한다. 경로형 링크는 이 prefix 를 모른 채 루트 기준으로 풀려 404 가 된다. bare-slug 는 quartz 가 파일명으로 전역 매칭해 공개 빌드·로컬 빌드 양쪽 모두 정확한 경로를 만든다.
  - 파일명이 전역 고유하므로 bare-slug 로 충분하다. alias·heading 은 붙여도 된다: `[[work-style|개발 스타일]]`.
  - **예외 — `raw/` Sources 링크는 경로형 유지**: `[[../../raw/notes/원본.md]]` 처럼 raw 를 가리키는 출처 링크는 빌드 대상이 아니므로 경로형 그대로 둔다.
4. **raw 는 출처**: wiki 의 주장은 raw 로 추적 가능해야 한다. 출처 없는 주장 금지.
5. **점진적 컴파일**: 한 번에 raw 전체를 처리하지 않는다. 새 raw 파일 또는 사용자가 지정한 범위만 처리.
6. **lint 는 별도 호출**: 무결성 점검은 사용자가 brain-lint 를 명시 요청할 때만 실행.

## 지식 유입 정책

fos-brain은 6개월 뒤에도 사용자의 업무 방식, 취향, 결정, 개인 시스템, 이력, 장기 분야 지식을 이해하는 데 필요한 개인 지식만 저장한다.
일반 설명, 일회성 작업, 코드와 git으로 자명한 사실, 실행 절차, 행동 규칙, 좁은 장애 우회법, 일시 상태는 올바른 단일 소스로 보내거나 제외한다.
회사 내부 지식은 public과 private 어느 쪽에도 저장하지 않고 nbrain으로 보낸다.

상세 판정 순서, 목적지, 공개 범위, 판정 기록 계약은 [`.agents/plugin/fos-brain/references/knowledge-admission-policy.md`](.agents/plugin/fos-brain/references/knowledge-admission-policy.md)를 단일 소스로 사용한다.
의미 적합성은 숫자 점수로 자동 승인하지 않으며, 저장 전 미리보기와 사용자 승인을 거친다.

## 페이지 스키마

### `wiki/concepts/<개념명>.md`

```markdown
---
type: concept
created: YYYY-MM-DD
updated: YYYY-MM-DD
title: "<개념명>"
description: "문서의 범위와 핵심을 설명하는 한 문장"
tags: ["주제"]
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

`type`, `created`, `updated`와 본문의 `## Sources`는 기존 필수 계약으로 계속 유지한다.
새 문서와 의미를 실질적으로 보강한 문서에는 `title`, `description`, `tags`를 함께 기록한다.
기존 문서는 이 필드가 없다는 이유만으로 일괄 변경하지 않는다.

문서 성격에 따라 아래 필드를 점진적으로 추가한다.

- `status` — 지식 수명 상태가 필요할 때 `draft`, `stable`, `deprecated` 중 하나를 기록한다.
- `stale_after` — 시간이 지나면 재검토해야 하는 사실에 `YYYY-MM-DD` 날짜를 기록한다.
- `sources` — 검색과 교환에 필요한 출처를 필수 `resource`, 선택적 `id`, 선택적 `title`을 가진 객체 배열로 기록한다.
- `generated` — 에이전트가 만든 문서에 생성 주체 `by`와 생성 시각 `at`을 기록한다.
- `verified` — 실제 검증 이력이 있을 때 검증 주체 `by`와 검증 시각 `at`을 가진 단일 객체나 객체 배열로 기록한다.

`sources`는 본문의 `## Sources`를 대체하지 않는다.
`generated`와 `verified`는 확인되지 않은 주체나 시각을 추정해서 채우지 않는다.

### `wiki/topics/<주제명>.md`

여러 concept 을 묶는 narrative. concept 과 같은 frontmatter 를 쓰고 "Concepts" 섹션에 `[[concept]]` 를 나열한다.

### `wiki/entities/<개체명>.md`

사람·프로젝트·목표 등. `type: entity` frontmatter. 관련 concept·topic 과 양방향 링크.

### 새 머신 설정

**권장: 플러그인으로 설치** (스킬과 hook을 함께 적용):

```bash
# Claude Code: settings.json을 직접 편집하는 것만으로는 반영되지 않는다. CLI로 등록·설치까지 실행한다.
claude plugin marketplace add "$HOME/personal/fos-brain/.agents/plugin/fos-brain"
claude plugin install fos-brain@fos-brain

# Codex CLI
codex plugin marketplace add "$HOME/personal/fos-brain/.agents/plugin/fos-brain"
codex plugin add fos-brain@fos-brain
```

두 도구 모두 로컬 마켓플레이스를 각자 캐시(`~/.claude/plugins/cache/fos-brain/`, `~/.codex/plugins/cache/fos-brain/`)에 **복사**해서 쓴다.
fos-brain 쪽 스크립트를 고치면 캐시가 자동으로 갱신되지 않으므로, 수정 후에는 위 install/add 명령을 다시 실행해 재설치한다(Claude Code는 `claude plugin update fos-brain`도 가능).

사용자 프롬프트마다 지식을 자동 주입하지 않는다.
필요한 지식은 사용자가 요청하거나 현재 작업에 실질적으로 필요할 때 `brain-search`를 명시적으로 호출해 검색한다.

`**.claude-plugin/plugin.json`에 `hooks`/`skills` 필드를 넣지 않는다**.
Claude Code는 플러그인 루트의 `hooks/hooks.json`과 `skills/`를 관례로 자동 로드한다.
manifest에 `"hooks": "./hooks/hooks.json"`처럼 명시하면 "Duplicate hooks file detected"로 설치가 실패한다.
Codex 쪽 루트 `plugin.json`은 반대로 이 필드가 필수다(oh-my-codex 관례). 두 매니페스트가 다르게 생긴 이유다.

**대안: 스킬만 심링크** (플러그인 시스템이 없는 에이전트용):

```bash
mkdir -p "$HOME/.claude/skills"
for s in brain-add brain-curate brain-search brain-lint brain-delete; do
  ln -sfn "$HOME/personal/fos-brain/.agents/skills/$s" "$HOME/.claude/skills/$s"
done
```

## brain-add 가 처리하는 소스

brain-add 는 다양한 소스를 `raw/` 로 가져와 파싱한다.


| 소스             | 처리 방식                              |
| -------------- | ---------------------------------- |
| 웹 기사·페이지       | WebFetch → markdown 본문             |
| 유튜브 링크         | `yt-dlp` 로 자막(자동·수동)과 메타 추출 → 텍스트 |
| PDF 논문         | Read 로 직접 파싱                       |
| GitHub repo    | clone / `gh` 로 README·코드           |
| 이미지            | Read 로 시각 분석                       |
| 붙여넣은 텍스트·로컬 파일 | 그대로                                |


유튜브는 영상·음성을 직접 듣지 못하므로 자막을 경유한다.
현재는 **자막 있는 영상만 우선 지원**한다.
자막 없는 영상의 로컬 STT(`whisper`)는 미설치 상태이며 나중에 추가한다.

## 검색 도구: qmd

규모가 커지면 `grep` 으로는 한계가 있다.
Karpathy 가 권장한 qmd(BM25, 벡터, LLM rerank)를 사용한다.

- 등록 컬렉션: `brain-wiki`(fos-brain/wiki), `brain-raw`(fos-brain/raw), `brain-private`(private/wiki, 로컬 전용)
- 1차 검색(BM25): `qmd search "<keyword>" -c brain-wiki`
- 의미 검색(벡터): `qmd vsearch "<text>" -c brain-wiki`
- 하이브리드 검색과 rerank(권장): `qmd query "<question>"`
- 인덱스 갱신: `qmd update`(파일 변경 후), `qmd embed`(임베딩 재생성)
- 상태 점검: `qmd status`

`brain-search` skill 은 wiki 가 일정 규모 이상이면 grep 대신 `qmd query` 를 1차 검색으로 사용한다.

### wrapper로 node 버전 고정 (ABI 불일치 방지)

qmd 는 `better-sqlite3` 네이티브 모듈을 쓰고, 이 모듈의 ABI 는 **실행 런타임에 종속**된다.
mise 가 디렉터리마다 node 버전을 바꾸므로 PATH 의 node 를 그대로 타면 실행 자체가 깨진다.

- 증상: `ERR_DLOPEN_FAILED` 와 `"better-sqlite3 재컴파일 필요"`. ABI 번호는 node24=137, node22=127 이다.
- 원인이 두 겹이다.
    - `bin/qmd` 의 shebang 이 `#!/usr/bin/env node` 라 런처 자신이 PATH 의 node 로 뜬다.
    - 런처가 내부에서 `spawn("node", [dist/cli/qmd.js])` 로 node 를 **한 번 더** PATH 에서 찾는다.
- **해결 — wrapper 로 고정**: `~/.local/bin-pinned/qmd` 가 node 24.15.0 을 절대 경로로 못박고, 런처를 건너뛰어 `dist/cli/qmd.js` 를 직접 실행한다. PATH 는 `~/.zshenv.d/10-pinned-bin.sh` 가 mise shim 보다 앞에 둔다.
    - 런처가 세팅하던 환경 변수(`GGML_METAL_NO_RESIDENCY`, MCP 모드의 로그 억제)는 wrapper 안에서 같은 규칙으로 재현한다.
    - qmd 를 재설치하거나 node 를 올리면 wrapper 의 고정 버전을 함께 갱신한다.
- **`bun.lock` touch 는 쓰지 않는다 (실측)**: 런처는 lockfile 로 런타임을 고르는데(`bun.lock`→bun, `package-lock.json`→node), bun 이 PATH 에 없으면 `qmd: failed to launch bun: spawn bun ENOENT` 로 죽는다. fos-brain 플러그인의 `setup-check.cjs` 가 매 세션 이 파일을 touch 하므로, 런처를 우회하는 wrapper 가 필요한 이유이기도 하다.
- 진단 순서: `which qmd` 로 wrapper 가 잡히는지 → `qmd collection list` 로 DB 접근이 되는지 → 고정한 node 버전이 아직 설치돼 있는지.
- qmd 가 끝내 안 되면 `brain-search` 는 grep 으로 폴백한다(품질은 떨어지지만 동작).

## 웹 UI: Quartz

연결된 지식을 그래프로 보는 웹 UI 는 Quartz v4 정적 사이트로 구축한다(`quartz/`).
공개 빌드와 로컬 전체 빌드 두 가지를 운영한다.

### 툴체인 전제

- node 24.15.0 핀(`quartz/.tool-versions` = mise, `quartz/.npmrc` 의 `use-node-version` = pnpm). quartz engines 는 `node >=22`. node 25 에선 tsx 가 `.scss` ESM 로딩에 실패하므로 24 를 쓴다(25 회피). 핀 파일은 루트가 아니라 `quartz/` 에 있다.
- pnpm(`packageManager` 필드). `quartz/.npmrc` 에 `node-linker=hoisted`(Quartz 가 phantom 의존성을 직접 import).
- fos-brain 은 **독립 git repo** 여야 한다. 홈(`/Users/nhn`)이 `*` 화이트리스트 .gitignore 라, fos-brain 에 자체 `.git` 이 없으면 Quartz 의 `isGitIgnored` 가 모든 content 를 걸러내 입력 0 이 된다.

### 공개 빌드 (`quartz/`)

- content: `quartz/content` → 루트 `wiki/` 심볼릭 링크(public 만). private 는 config `ignorePatterns` 로 제외.
- 기능: 그래프 뷰, 전문 검색, 백링크 패널
- 서빙: `cd quartz && pnpm quartz build --serve` (기본 포트 8080)
- 외부 게시(GitHub Pages 등)는 별도 요청 시에만. raw RAG 분석 등 공개 적정성 확인 후.

### 로컬 전체 빌드 (`quartz-local/`)

- content: public 과 private 을 합친 전체 그래프. 비공개 폴더는 `_private` 로 병합(공개 config 의 ignore 회피).
- 병합 content 는 repo 밖 temp 에 생성(repo 안이면 `.gitignore` 때문에 입력이 걸러짐).
- **gitignore 대상**(`quartz-local/content`, `quartz-local/public`) — 절대 게시하지 않는다.
- 서빙: `./quartz-local/serve.sh` (포트 8081)
