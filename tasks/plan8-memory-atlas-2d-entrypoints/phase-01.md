# Phase 01 qmd 의미 관계 생성과 공개 범위 정제

**Execution profile**: deep

---

## 목표

qmd의 vector 검색 결과를 정적 Memory Atlas가 읽을 수 있는 slug 관계로 생성하고, 현재 Quartz 빌드에 포함된 문서만 게시되도록 공개 범위 경계를 고정한다.

**범위 외**: 2D 화면, 모드 전환, 자동 시작점 계산과 홈서버 배포는 이 phase에서 구현하지 않는다.

---

## 작업 항목 (4)

### 1. 임시 산출물 위치와 스키마

`.gitignore`에 `quartz/.generated/`를 추가한다.
`quartz/quartz/components/memoryAtlasSemantics.ts`에 `schemaVersion: 1`, `generatedAt`, `scope`, `source: qmd-vector`, `edges` 계약을 정의한다.
edge는 slug를 사전순으로 정규화한 undirected 쌍이며 `source`, `target`, 0부터 1까지의 `score`만 가진다.
parser는 알 수 없는 버전, 잘못된 날짜·slug·점수, self-link와 중복을 처리하며 호출자가 오류와 빈 산출물을 구분할 수 있게 한다.

### 2. qmd HTTP 의미 관계 생성기

`quartz/scripts/generate-memory-atlas-semantics.mjs`는 명시적으로 받은 `collection=wiki-root` 대응과 `BRAIN_QMD_URL`만 사용한다.
wiki 문서의 frontmatter에서 제목, 설명과 tag를 읽어 `POST /query`에 단일 `vec` 검색으로 보내고 허용 collection의 결과만 받는다.
public 실행은 `brain-wiki`만, protected 실행은 `brain-wiki`와 `brain-private`를 허용한다.
`qmd://brain-wiki/<path>.md`는 public slug로, `qmd://brain-private/<path>.md`는 `_private/` slug로 바꾼다.
결과에는 원문, 제목, tag, 발췌문, qmd 주소와 모델 cache를 기록하지 않는다.

생성 시작 전에 이전 출력 파일을 제거하고 임시 파일을 완성한 뒤 atomic rename한다.
HTTP 오류, timeout, 허용하지 않은 collection, root 밖 경로와 JSON 계약 오류가 나면 출력 파일을 남기지 않고 실패한다.
CLI는 출력 경로, scope, collection 대응, 결과 제한과 최소 점수를 인자로 받으며 실제 service 주소와 host 경로를 기본값으로 코드에 넣지 않는다.

### 3. Quartz 게시 전 재검증

`memoryAtlasAssets.ts`는 기존 runtime bundle 동작을 유지하면서 임시 의미 관계 파일을 선택적으로 읽는다.
현재 `ProcessedContent`의 slug가 양쪽에 있는 edge만 남기고, public 콘텐츠만 있는 빌드에서는 `_private/` endpoint를 거부한다.
검증된 결과를 `/static/memory-atlas-semantics.json`으로 내보낸다.
임시 파일이 없거나 parser가 거부하면 `edges: []`인 유효한 파일을 내보내 Quartz 빌드와 기존 3D 탐색을 계속한다.

### 4. 생성기와 privacy 회귀 검사

Node 표준 라이브러리의 임시 wiki root와 mock HTTP server를 사용해 정상 생성, 중복 score 병합, self-link, 낮은 score, timeout과 원자적 실패를 검사한다.
TypeScript 단위 검사는 schema 거부, 현재 slug 제한, protected 임시 파일을 public 콘텐츠로 정제할 때 private edge가 남지 않는 사례를 포함한다.
실패 출력에는 private 제목과 본문을 넣지 않고 collection, slug 개수와 오류 종류만 남긴다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.gitignore` | `quartz/.generated/` 추가 |
| `quartz/scripts/generate-memory-atlas-semantics.mjs` | qmd vector 관계 생성기 추가 |
| `quartz/scripts/generate-memory-atlas-semantics.test.mjs` | 생성기와 실패 회귀 추가 |
| `quartz/quartz/components/memoryAtlasSemantics.ts` | 산출물 parser와 정제 함수 추가 |
| `quartz/quartz/components/memoryAtlasSemantics.test.ts` | schema와 namespace 회귀 추가 |
| `quartz/quartz/plugins/emitters/memoryAtlasAssets.ts` | 검증된 의미 관계 정적 파일 추가 |

## 검증

```bash
# cwd: <worktree>/
node --test quartz/scripts/generate-memory-atlas-semantics.test.mjs
git diff --check
```

```bash
# cwd: <worktree>/quartz
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check quartz/components/memoryAtlasSemantics.ts quartz/components/memoryAtlasSemantics.test.ts quartz/plugins/emitters/memoryAtlasAssets.ts scripts/generate-memory-atlas-semantics.mjs scripts/generate-memory-atlas-semantics.test.mjs
```

임시 protected fixture에 private edge를 넣은 뒤 public 콘텐츠 목록으로 정제한 결과에는 `_private/` 문자열과 private endpoint가 없어야 한다.

## 의도 메모 (왜)

- qmd를 Quartz의 필수 build 의존성으로 만들지 않아 일반 정적 빌드와 의미 관계 생성의 장애를 분리한다.
- 게시 직전에 현재 콘텐츠로 다시 제한해 남아 있는 protected 임시 파일도 public 정보 누출 원인이 되지 않게 한다.
- 의미 계산값을 wiki에 쓰지 않아 원래 지식 관계와 모델 결과의 수명 주기를 섞지 않는다.
