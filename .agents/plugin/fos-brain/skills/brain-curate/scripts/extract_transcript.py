#!/usr/bin/env python3
"""Claude Code 세션 jsonl 을 durable 지식 추출용 정제 텍스트로 변환한다.

핵심 문제: jsonl 한 파일이 수 MB~십수 MB 인데 대부분이 tool 출력(파일 dump·빌드 로그)이다.
통째로 LLM 에 넣으면 토큰이 폭발하고, 통째로 버리면 "무엇을 왜 했는가" 맥락이 사라진다.
그래서 메시지 타입별로 다르게 정제한다:

- user 발화        → 보존 (단 system-reminder·hook·command 노이즈 제거)
- assistant 텍스트 → 보존 (사고 결론)
- assistant thinking → 기본 제외 (--keep-thinking 으로 절단 보존)
- assistant tool_use → 도구명 + 핵심 인자 1줄로 요약
- user tool_result → 상한선 절단 (--max-result-chars). 에러 라인은 우선 보존

사용:
    python3 extract_transcript.py <session.jsonl> [--max-result-chars N] [--keep-thinking]
출력은 stdout (정제된 markdown). 후보 추출 sub-agent 가 이 출력을 읽는다.
"""
import argparse
import json
import re
import sys

# 사용자 발화에서 걷어낼 하네스 주입 노이즈 (실제 사람 입력이 아님)
NOISE_TAG_RE = re.compile(
    r"<(system-reminder|command-message|command-name|command-args|"
    r"local-command-stdout|local-command-stderr)>.*?</\1>",
    re.DOTALL,
)
# 닫는 태그가 없는 변종도 한 줄 단위로 제거
NOISE_LINE_RE = re.compile(
    r"^\s*<(system-reminder|command-name|command-message)>.*$", re.MULTILINE
)
# tool_result 에서 우선 보존할 신호 (에러·실패·결론)
SIGNAL_RE = re.compile(
    r"(error|exception|traceback|failed|fail|fatal|warning|"
    r"오류|에러|실패|예외)",
    re.IGNORECASE,
)


def clean_user_text(text: str) -> str:
    text = NOISE_TAG_RE.sub("", text)
    text = NOISE_LINE_RE.sub("", text)
    return text.strip()


def summarize_tool_use(block: dict) -> str:
    """tool_use 블록을 도구명 + 핵심 인자 한 줄로 압축한다."""
    name = block.get("name", "tool")
    inp = block.get("input", {}) or {}
    # 도구별로 가장 의미 있는 인자 하나를 고른다
    hint = ""
    for key in ("command", "file_path", "path", "pattern", "query",
                "description", "prompt", "url", "old_string"):
        if key in inp and inp[key]:
            val = str(inp[key]).replace("\n", " ")
            hint = val[:120]
            break
    return f"[tool:{name}] {hint}".rstrip()


def truncate_result(text: str, limit: int) -> str:
    """tool_result 를 상한선까지 절단하되 에러·실패 신호 라인은 우선 남긴다."""
    if len(text) <= limit:
        return text
    head = text[:limit]
    # 절단된 뒤쪽에서 에러 신호 라인만 골라 덧붙인다
    tail = text[limit:]
    signal_lines = [ln for ln in tail.splitlines() if SIGNAL_RE.search(ln)]
    omitted = text.count("\n") - head.count("\n") - len(signal_lines)
    extra = ""
    if signal_lines:
        extra = "\n…(중략, 신호 라인 보존)\n" + "\n".join(signal_lines[:20])
    return f"{head}\n…({max(omitted,0)}줄 생략){extra}"


def block_text(content) -> list[tuple[str, str]]:
    """message.content (str | list) 를 (kind, text) 튜플 목록으로 펼친다."""
    out = []
    if isinstance(content, str):
        out.append(("text", content))
    elif isinstance(content, list):
        for b in content:
            if not isinstance(b, dict):
                continue
            bt = b.get("type")
            if bt == "text":
                out.append(("text", b.get("text", "")))
            elif bt == "thinking":
                out.append(("thinking", b.get("thinking", "")))
            elif bt == "tool_use":
                out.append(("tool_use", summarize_tool_use(b)))
            elif bt == "tool_result":
                c = b.get("content", "")
                if isinstance(c, list):
                    c = "\n".join(
                        x.get("text", "") for x in c
                        if isinstance(x, dict) and x.get("type") == "text"
                    )
                out.append(("tool_result", str(c)))
    return out


def detect_format(path: str) -> str:
    """첫 몇 줄을 보고 claude/codex jsonl 포맷을 구분한다."""
    with open(path, encoding="utf-8") as fh:
        for _ in range(5):
            line = fh.readline()
            if not line:
                break
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            if o.get("type") in ("session_meta", "response_item", "event_msg", "turn_context"):
                return "codex"
    return "claude"


def extract_claude(path: str, args) -> list[str]:
    out_lines = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = o.get("type")
            if t not in ("user", "assistant"):
                continue  # mode/attachment/system/file-history 등 노이즈
            msg = o.get("message", {}) or {}
            for kind, text in block_text(msg.get("content")):
                if not text:
                    continue
                if t == "user":
                    if kind == "tool_result":
                        body = truncate_result(text, args.max_result_chars)
                        out_lines.append(f"[tool_result]\n{body}")
                    else:
                        cleaned = clean_user_text(text)
                        if cleaned:
                            out_lines.append(f"## USER\n{cleaned}")
                else:  # assistant
                    if kind == "text":
                        out_lines.append(f"## ASSISTANT\n{text.strip()}")
                    elif kind == "thinking":
                        if args.keep_thinking:
                            out_lines.append(
                                "[thinking]\n" + text[:args.max_result_chars].strip()
                            )
                    elif kind == "tool_use":
                        out_lines.append(text)
    return out_lines


def summarize_codex_call(p: dict) -> str:
    """Codex function_call payload 를 도구명 + 핵심 인자 한 줄로 압축한다."""
    name = p.get("name", "tool")
    raw_args = p.get("arguments", "")
    hint = ""
    try:
        parsed = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
        if isinstance(parsed, dict):
            for key in ("command", "file_path", "path", "pattern", "query", "workdir"):
                if key in parsed and parsed[key]:
                    hint = str(parsed[key]).replace("\n", " ")[:120]
                    break
    except (json.JSONDecodeError, TypeError):
        hint = str(raw_args)[:120]
    return f"[tool:{name}] {hint}".rstrip()


def extract_codex(path: str, args) -> list[str]:
    """Codex CLI rollout jsonl (~/.codex/sessions/**/*.jsonl) 정제.

    event_msg.user_message/agent_message 를 텍스트 소스로 쓰고, response_item.message 는
    environment_context 등 하네스 wrapper 가 섞여 있어 건너뛴다(user_message/agent_message 와 중복).
    """
    out_lines = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                o = json.loads(line)
            except json.JSONDecodeError:
                continue
            p = o.get("payload", {}) or {}
            pt = p.get("type")
            if pt == "user_message":
                cleaned = clean_user_text(p.get("message", ""))
                if cleaned:
                    out_lines.append(f"## USER\n{cleaned}")
            elif pt == "agent_message":
                text = (p.get("message", "") or "").strip()
                if text:
                    out_lines.append(f"## ASSISTANT\n{text}")
            elif pt == "agent_reasoning":
                if args.keep_thinking:
                    text = (p.get("text", "") or "")[: args.max_result_chars].strip()
                    if text:
                        out_lines.append(f"[thinking]\n{text}")
            elif pt in ("function_call", "custom_tool_call"):
                out_lines.append(summarize_codex_call(p))
            elif pt in ("function_call_output", "custom_tool_call_output"):
                output = str(p.get("output", ""))
                if output:
                    body = truncate_result(output, args.max_result_chars)
                    out_lines.append(f"[tool_result]\n{body}")
    return out_lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("session", help="세션 jsonl 경로")
    ap.add_argument("--format", choices=["auto", "claude", "codex"], default="auto",
                    help="세션 jsonl 포맷 (기본: 자동 감지)")
    ap.add_argument("--max-result-chars", type=int, default=1500,
                    help="tool_result 절단 상한 (기본 1500자)")
    ap.add_argument("--keep-thinking", action="store_true",
                    help="assistant thinking 을 절단 보존 (기본 제외)")
    args = ap.parse_args()

    fmt = args.format if args.format != "auto" else detect_format(args.session)
    out_lines = extract_codex(args.session, args) if fmt == "codex" else extract_claude(args.session, args)

    sys.stdout.write("\n\n".join(out_lines) + "\n")


if __name__ == "__main__":
    main()
