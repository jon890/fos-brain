# Phase 01 — OKF 호환 계약과 내보내기

**Execution profile**: deep

---

## 목표

내부 bare-slug 링크를 유지하면서 public 지식을 OKF v0.2 호환 묶음으로 안전하게 내보낸다.

**범위 외**: 검색 순위와 Quartz 화면은 다음 phase가 담당한다.

---

## 작업 항목 (4)

### 1. 프로젝트 지식 계약 갱신

`CLAUDE.md`의 페이지 스키마에 `title`, `description`, `tags`, `status`, `stale_after`, `sources`, `generated`, `verified`의 점진적 적용 규칙을 추가한다.
기존 `type`, `created`, `updated`와 본문 `## Sources`는 계속 유지한다.
`.gitignore`에 `.claude/worktrees/`를 추가해 격리 실행 파일이 main 작업 트리에 노출되지 않게 한다.

### 2. brain-add와 brain-lint 스킬 보강

`.agents/plugin/fos-brain/skills/brain-add/SKILL.md`가 새 문서와 실질 보강 문서에 권장 메타데이터를 작성하게 한다.
`.agents/plugin/fos-brain/skills/brain-lint/SKILL.md`는 기존 문서를 일괄 실패시키지 않고 권장 메타데이터의 누락과 잘못된 날짜·상태만 품질 점검에서 보고하게 한다.

### 3. public 전용 OKF 내보내기 구현

`.agents/plugin/fos-brain/scripts/okf-export.cjs`를 추가한다.
입력은 저장소 루트와 출력 경로이며, public `wiki/`와 `raw/`만 복사한다.
wiki 문서의 bare-slug와 raw wikilink를 묶음 내부 상대 Markdown 링크로 바꾸고 루트 `index.md`를 만든다.
기존 frontmatter 원문을 보존하고 최상위 키의 존재만 정규식으로 감지한다.
누락된 type, title, description, generated만 JSON 호환 YAML 값으로 삽입하며 기존 중첩 배열·객체는 재직렬화하지 않는다.
출력 경로가 존재하거나 링크 대상을 해석하지 못하면 비파괴적으로 실패한다.

### 4. 내보내기 계약 검사 추가

`.agents/plugin/fos-brain/tests/okf-export.test.cjs`에 임시 public·private fixture를 만든다.
필수 메타데이터 보완, 링크 변환, private 제외, 기존 출력 보호를 검사한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.gitignore` | 수정 |
| `CLAUDE.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-add/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-lint/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/scripts/okf-export.cjs` | 신규 |
| `.agents/plugin/fos-brain/tests/okf-export.test.cjs` | 신규 |

## 검증

```bash
# cwd: <worktree>/
node --test .agents/plugin/fos-brain/tests/okf-export.test.cjs
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-add
python3 /Users/nhn/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-lint
```

두 스킬 검사가 성공하고 내보내기 단위 검사가 실패 없이 끝나야 한다.

## 의도 메모 (왜)

- 초기 규격의 변화 비용을 내보내기 경계에 격리한다.
- private 자료는 입력 탐색부터 제외해 공개 산출물 누출을 막는다.
