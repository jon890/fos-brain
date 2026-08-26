---
name: brain-search
description: Hermes에서 개인 지식 기반 fos-brain의 public·private wiki를 HTTP qmd 우선으로 검색한다. brain search, brain 검색, 내 brain, 내 지식 기반, wiki query 요청에 사용한다.
---

# Hermes brain-search 어댑터

이 스킬은 fos-brain 원본 스킬을 Hermes에서 실행하기 위한 어댑터다.
정책과 검색 절차의 단일 원본은 `/home/bifos/personal/fos-brain/.agents/skills/brain-search/SKILL.md`다.

## 사용 절차

1. 먼저 원본 스킬과 `/home/bifos/personal/fos-brain/CLAUDE.md`를 읽는다.
2. 회사 규칙이나 사내 시스템 지식이면 개인 brain을 검색하지 않고 `nbrain`으로 보낸다.
3. `BRAIN_QMD_URL`이 있으면 public과 private를 각각 검색한다.
   - public: `node /opt/data/skills/note-taking/brain-search/brain-search-http.cjs "<질문>" '["brain-wiki"]' 5`
   - private: `node /opt/data/skills/note-taking/brain-search/brain-search-http.cjs "<질문>" '["brain-private"]' 5`
4. HTTP 검색이 실패하면 `/opt/data/home/.local/bin/qmd`, 네임스페이스별 `wiki/INDEX.md`, Hermes `search_files` 순서로 축소한다.
5. 후보 페이지를 최대 5개 정독하고 관련 wikilink를 한 단계만 따라간다. 근거가 부족할 때만 같은 네임스페이스의 Sources를 따라 raw를 읽는다.
6. 답변에는 `[public]`, `[private]` 출처와 wiki slug를 표시한다. private 내용을 공개 문서에 옮기지 않는다.
7. 새 통찰을 저장할 가치가 있어도 사용자 승인 없이 brain을 변경하지 않는다.

## Hermes 도구 매핑

- 원본 스킬의 `Read`는 `read_file`로 실행한다.
- 원본 스킬의 `rg`와 `find`는 `search_files`로 실행한다.
- HTTP client와 로컬 qmd는 `terminal`로 실행한다.
- 사용자 확인이 꼭 필요하면 `clarify`를 사용한다.

## 금지

- 출처 없는 추측을 brain 정보처럼 말하지 않는다.
- private raw를 검색하거나 HTTP 서비스에 마운트하지 않는다.
- 회사 지식을 public이나 private brain에 저장하지 않는다.
- raw 파일을 수정하지 않는다.
