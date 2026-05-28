#!/usr/bin/env python3
"""brain-usage — fos-brain 지식이 Claude Code 세션에서 실제로 쓰였는지 집계.

Claude Code 트랜스크립트(~/.claude/projects/**/*.jsonl)를 세션별로 시간순 파싱해
brain 접근(MCP/스킬/qmd CLI)과 인용을 다음 3갈래로 분류한다.

  - 검색 기반 인용 (genuine) : 같은 세션에서 검색으로 페이지를 꺼낸 *뒤* 인용  ← 핵심 지표
  - 비검색 인용              : 검색 없이 인용 (모델 기억 / 단순 논의)
  - 작성 활동               : 그 세션에서 해당 페이지를 Write/Edit (브레인 작성/유지보수)

사용:
  python3 scripts/brain-usage.py            # 전체 기간
  python3 scripts/brain-usage.py --days 7   # 최근 7일
"""
import json, glob, os, re, argparse, collections
from datetime import datetime, timezone, timedelta

BRAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECTS = os.path.expanduser("~/.claude/projects")

WIKI_DIRS = [os.path.join(BRAIN, "wiki")]
WIKI_DIRS += glob.glob(os.path.join(BRAIN, "work", "*", "wiki"))
WIKI_DIRS += [os.path.join(BRAIN, "private", "wiki")]

QMD_URI = re.compile(r"qmd://brain[\w-]*/([^\s\)\]\"']+\.md)")
WIKILINK = re.compile(r"\[\[([^\]]+)\]\]")


def brain_slugs():
    slugs = {}
    for wd in WIKI_DIRS:
        for p in glob.glob(os.path.join(wd, "**", "*.md"), recursive=True):
            base = os.path.basename(p)[:-3]
            if base in ("INDEX", "log"):
                continue
            slugs[base] = os.path.relpath(p, BRAIN)
    return slugs


def parse_ts(o):
    ts = o.get("timestamp") or o.get("ts")
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None


def blocks(o):
    msg = o.get("message", {})
    cont = msg.get("content") if isinstance(msg, dict) else None
    return cont if isinstance(cont, list) else []


def as_text(x):
    if isinstance(x, str):
        return x
    if isinstance(x, list):
        return " ".join(as_text(i) for i in x)
    if isinstance(x, dict):
        return as_text(x.get("text") or x.get("content") or "")
    return ""


def slug_of_path(fp):
    if not fp.endswith(".md"):
        return None
    return os.path.basename(fp)[:-3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=0, help="최근 N일만 (0=전체)")
    args = ap.parse_args()
    cutoff = None
    if args.days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)

    slugs = brain_slugs()

    mcp_calls = cli_calls = 0
    skill_calls = collections.Counter()
    by_day = collections.Counter()
    retrieved_tot = collections.Counter()    # 검색이 반환한 페이지 (slug 한정)
    genuine = collections.Counter()          # 검색 기반 인용
    nonsearch = collections.Counter()        # 비검색 인용
    authoring = collections.Counter()        # 작성 세션 인용

    files = glob.glob(os.path.join(PROJECTS, "**", "*.jsonl"), recursive=True)
    for f in files:
        try:
            fh = open(f, encoding="utf-8")
        except OSError:
            continue
        # ---- 세션 1차 패스: 이 세션에서 작성(Write/Edit)된 brain 페이지 수집 ----
        authored = set()
        events = []  # (kind, payload) 시간순
        for line in fh:
            try:
                o = json.loads(line)
            except Exception:
                continue
            ts = parse_ts(o)
            if cutoff and ts and ts < cutoff:
                continue
            day = ts.date().isoformat() if ts else "?"
            for b in blocks(o):
                if not isinstance(b, dict):
                    continue
                bt = b.get("type")
                if bt == "tool_use":
                    name = b.get("name", "")
                    inp = b.get("input", {}) if isinstance(b.get("input"), dict) else {}
                    if name.startswith("mcp__qmd"):
                        events.append(("access", ("MCP", day)))
                    elif name == "Skill" and str(inp.get("skill", "")).startswith("brain"):
                        events.append(("skill", (inp["skill"], day)))
                    elif name == "Bash":
                        cmd = str(inp.get("command", ""))
                        if re.search(r"\bqmd\s+(search|query|vsearch|get)\b", cmd):
                            events.append(("access", ("CLI", day)))
                    elif name in ("Write", "Edit", "NotebookEdit"):
                        s = slug_of_path(str(inp.get("file_path", "")))
                        if s in slugs:
                            authored.add(s)
                txt = as_text(b)
                # 검색 반환(브레인 slug 한정) — retrieval 이벤트
                for m in QMD_URI.findall(txt):
                    s = os.path.basename(m)[:-3]
                    if s in slugs:
                        events.append(("retrieve", s))
                # 인용 — assistant 텍스트의 [[slug]]
                if bt == "text":
                    for m in WIKILINK.findall(b.get("text", "")):
                        s = os.path.basename(m.split("|")[0]).replace(".md", "").strip()
                        if s in slugs:
                            events.append(("cite", s))

        # ---- 세션 2차 패스: 시간순으로 분류 ----
        seen_retrieved = set()
        for kind, payload in events:
            if kind == "access":
                route, day = payload
                if route == "MCP":
                    mcp_calls += 1
                else:
                    cli_calls += 1
                by_day[day] += 1
            elif kind == "skill":
                sk, day = payload
                skill_calls[sk] += 1
                by_day[day] += 1
            elif kind == "retrieve":
                seen_retrieved.add(payload)
                retrieved_tot[payload] += 1
            elif kind == "cite":
                s = payload
                if s in authored:
                    authoring[s] += 1
                elif s in seen_retrieved:
                    genuine[s] += 1
                else:
                    nonsearch[s] += 1

    # ---- 리포트 ----
    period = f"최근 {args.days}일" if args.days else "전체 기간"
    print(f"# brain-usage 리포트 ({period})")
    print(f"스캔 트랜스크립트: {len(files)}개 | brain 페이지: {len(slugs)}개\n")

    total_access = mcp_calls + cli_calls + sum(skill_calls.values())
    print("## brain 접근 경로")
    print(f"- qmd MCP 검색 : {mcp_calls}회")
    print(f"- qmd CLI 검색 : {cli_calls}회")
    print(f"- 스킬 호출    : {sum(skill_calls.values())}회 {dict(skill_calls) if skill_calls else ''}")
    print(f"- 합계         : {total_access}회\n")

    if by_day:
        print("## 날짜별 접근 (최근 10일)")
        for d in sorted(by_day, reverse=True)[:10]:
            print(f"  {d}: {by_day[d]}")
        print()

    print(f"## 인용 분류 (genuine={sum(genuine.values())} / 비검색={sum(nonsearch.values())} / 작성={sum(authoring.values())})")
    print("\n### ★ 검색 기반 인용 (genuine use — 핵심 지표)")
    if genuine:
        for s, c in genuine.most_common(10):
            print(f"  {c:3}  [[{s}]]")
    else:
        print("  (아직 없음 — 검색→인용 흐름은 MCP 활성 세션부터 쌓임)")
    print("\n### 비검색 인용 (모델 기억/논의)")
    for s, c in nonsearch.most_common(5):
        print(f"  {c:3}  [[{s}]]")
    print("\n### 작성 활동 (브레인 유지보수 세션)")
    for s, c in authoring.most_common(5):
        print(f"  {c:3}  [[{s}]]")
    print()

    print("## 검색에서 반환된 페이지 Top 10")
    if retrieved_tot:
        for s, c in retrieved_tot.most_common(10):
            print(f"  {c:3}  {s}")
    else:
        print("  (아직 없음)")
    print()

    used = set(genuine) | set(retrieved_tot)
    dead = sorted(s for s in slugs if s not in used)
    print(f"## 미사용 페이지 ({len(dead)}/{len(slugs)}) — 검색·genuine 기준 archive 후보")
    for s in dead[:30]:
        print(f"  - {s}  ({slugs[s]})")
    if len(dead) > 30:
        print(f"  ... 외 {len(dead)-30}개")

    if total_access == 0:
        print("\n※ 아직 brain 접근 기록 없음. MCP 는 다음 세션부터 집계.")


if __name__ == "__main__":
    main()
