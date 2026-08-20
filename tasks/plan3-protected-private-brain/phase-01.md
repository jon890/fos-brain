# Phase 01: 개인 brain 네임스페이스 경계 정리

**Execution profile**: standard

---

## 목표

개인 brain의 스킬과 로컬 Quartz에서 폐기한 회사·work 네임스페이스를 제거하고 public·private 두 네임스페이스만 남긴다.

**범위 외**: 기존 public·private 지식 내용의 일괄 이동이나 삭제, nbrain 변경, 홈서버 배포는 수행하지 않는다.

---

## 작업 항목 (3)

### 1. 스킬의 회사 네임스페이스 제거

`brain-curate`, `brain-delete`, `brain-lint`, `brain-search`가 개인 brain에서 회사·work 경로를 선택하거나 탐색하지 않게 한다.
회사 자료 요청은 기존 전역 지침에 따라 nbrain으로 라우팅하고 개인 brain에 저장하지 않는다.

### 2. 미리보기와 세션 후보 필터 정리

`brain-add`와 `brain-curate` 미리보기에서 work 표시를 제거한다.
세션 수집은 회사 경로를 결과에 포함하지 않으며 회사 판정 근거는 사용자 출력에 원문으로 노출하지 않는다.

### 3. 로컬 전체 Quartz를 두 네임스페이스로 제한

`quartz-local/serve.sh`는 public wiki와 private wiki만 합친다.
로컬 그래프에서도 raw와 work 디렉터리를 입력하지 않고 public 루트와 `/_private/` 경로를 유지한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `.agents/plugin/fos-brain/skills/brain-add/scripts/generate_preview.py` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-add/templates/preview.html` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/references/extraction-criteria.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/scripts/generate_preview.py` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/scripts/list_sessions.py` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-curate/templates/preview.html` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-delete/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-lint/SKILL.md` | 수정 |
| `.agents/plugin/fos-brain/skills/brain-search/SKILL.md` | 수정 |
| `quartz-local/serve.sh` | 수정 |

## 검증

```bash
# cwd: <worktree>/
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-add
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-curate
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-delete
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-lint
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/plugin/fos-brain/skills/brain-search
bash -n quartz-local/serve.sh
```

수정 파일에서 개인 brain의 제3 네임스페이스 선택지가 없어야 한다.

## 의도 메모 (왜)

- 개인 brain의 저장 경계가 public·private 두 개라는 저장소 계약과 스킬 동작을 일치시킨다.
- 회사 자료는 별도 nbrain이 소유하므로 개인 보호 사이트에도 복제하지 않는다.
