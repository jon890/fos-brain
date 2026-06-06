---
type: concept
created: 2026-06-02
updated: 2026-06-02
---

# OpenClaw web_search

`web_search` 는 provider 무관 도구다. provider 를 비우면 autodetect 가 동작한다.

## 동작 개요

- `web_search` 는 설정된 provider 로 웹을 검색해 결과를 돌려준다.
- 경량 HTTP 도구다(브라우저 자동화 아님). JS 무거운 사이트·로그인은 browser 도구로.
- 같이 묶이는 도구.
  - `web_fetch` — 경량 URL 본문 가져오기.
  - `x_search` — X(트위터) 게시물 검색.
- 결과는 쿼리별 15분 캐시(설정 가능).

## Provider 설정

- 설정 경로: `tools.web.search.provider` 와 `tools.web.search.enabled`.
- provider 를 **명시하면 그 백엔드로 고정**.
- provider 를 **생략하면 autodetect** — 사용 가능한 키/설정이 있는 쪽을 우선 잡고, 없으면 key-free fallback 으로 내려간다.
- 설정 도구: `openclaw configure --section web`.

## Autodetect 우선순위

provider 미지정 시 이 순서로 점검한다.

1. Brave
2. MiniMax
3. Gemini
4. Grok
5. Kimi
6. Perplexity
7. Firecrawl
8. Exa
9. Tavily
10. DuckDuckGo
11. Ollama
12. SearXNG

## Key-free provider

API 키 없이 쓰는 옵션.

- DuckDuckGo — 실험적·비공식(HTML 파싱), 가끔 깨질 수 있음.
- SearXNG — 셀프호스트 메타검색, 프라이버시·air-gap.
- Ollama — API 키는 불필요하나 `ollama signin` 과 도달 가능한 Ollama 호스트 필요.

## 교훈

- provider 를 죽은 백엔드(예: Ollama 미실행)에 고정하면 `web_search` 가 통째로 깨진다(`fetch failed`).
- 그럴 때 provider 를 비워 autodetect 로 전환하면 살아있는 provider(예: DuckDuckGo)로 fallback 한다.

## 관련 개념

- [[openclaw-tool-policy]] — group:web 에 web_search 포함
- [[openclaw-config]] — 설정 변경 방법
- [[openclaw]] — 상위 주제

## Sources

- [[../../raw/notes/2026-06-02-openclaw-knowledge-session.md]]
- docs.openclaw.ai/tools/web, docs.openclaw.ai/tools/ollama-web-search
- orphan transcript mining: `~/.openclaw/agents/main/sessions/35285f5d-2fd6-476e-8ad0-51dceb7db951.jsonl` (2026-04-13)
