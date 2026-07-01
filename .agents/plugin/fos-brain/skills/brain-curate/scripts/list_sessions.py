#!/usr/bin/env python3
"""분석 대상 Claude Code 세션 jsonl 을 범위 조건으로 골라 JSON 으로 출력한다.

brain-curate 의 1단계(범위 선정)에서 쓴다. 증분(워터마크) 또는 명시 범위로 좁힌다:

- --since EPOCH   : 이 시각 이후 수정된(mtime) 세션만 (증분 워터마크)
- --days N        : 최근 N 일 이내 수정된 세션만
- --project SUBSTR : 폴더명에 이 문자열이 든 프로젝트만 (반복 지정 가능)
- --min-bytes N   : 이 크기 미만 세션 제외 (durable 지식 확률 낮은 자투리 제거)
- --exclude-temp  : temp/skillopt/worktree 경로 제외 (기본 off — 노이즈 판단은 추출 단계에 위임)

출력(JSON, stdout): mtime 내림차순 목록. 각 항목:
    {path, folder, decoded(표시용), mtime, mtime_iso, size, namespace_guess}
namespace_guess 는 폴더 경로 문자열 기반 거친 추정이며, 최종 확정은 사용자 확인을 거친다.
"""
import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"
CODEX_SESSIONS = Path.home() / ".codex" / "sessions"
TEMP_RE = re.compile(r"(/T/|-T-|skillopt|worktree|/tmp|var-folders)", re.IGNORECASE)


def decode_folder(folder: str) -> str:
    """인코딩된 폴더명을 표시용 경로로 되돌린다 (best-effort).

    Claude Code 는 cwd 의 '/' 를 '-' 로 인코딩한다. 원래 하이픈과 구분이 안 되므로
    완벽한 역변환은 불가능하다. 표시·네임스페이스 추정용으로만 쓴다."""
    s = folder
    if s.startswith("-"):
        s = s[1:]
    return "/" + s.replace("-", "/")


def guess_namespace(decoded: str) -> str:
    """경로 문자열로 네임스페이스를 거칠게 추정한다. 최종 확정은 사용자 확인."""
    low = decoded.lower()
    # 회사 업무 레포로 보이는 경로 패턴 (사용자 환경에 맞게 조정 가능)
    if any(k in low for k in ("/projects/", "/work/", "nhnent", "/ai-playground")):
        return "work"
    if "/personal/" in low or "/obsidian" in low:
        return "public"
    return "unknown"


def codex_session_cwd(jf: Path) -> str:
    """rollout jsonl 첫 줄(session_meta)에서 cwd 를 읽는다. 실패하면 빈 문자열."""
    try:
        with open(jf, encoding="utf-8") as fh:
            first = fh.readline()
        o = json.loads(first)
        return o.get("payload", {}).get("cwd", "") or ""
    except (OSError, json.JSONDecodeError):
        return ""


def list_claude_sessions(args, cutoff) -> list[dict]:
    rows = []
    if not PROJECTS.exists():
        return rows
    for folder in PROJECTS.iterdir():
        if not folder.is_dir():
            continue
        fname = folder.name
        if args.exclude_temp and TEMP_RE.search(fname):
            continue
        if args.project and not any(p in fname for p in args.project):
            continue
        for jf in folder.glob("*.jsonl"):
            try:
                st = jf.stat()
            except OSError:
                continue
            if cutoff is not None and st.st_mtime <= cutoff:
                continue
            if st.st_size < args.min_bytes:
                continue
            decoded = decode_folder(fname)
            rows.append({
                "tool": "claude",
                "path": str(jf),
                "folder": fname,
                "decoded": decoded,
                "mtime": st.st_mtime,
                "mtime_iso": time.strftime("%Y-%m-%d %H:%M",
                                           time.localtime(st.st_mtime)),
                "size": st.st_size,
                "namespace_guess": guess_namespace(decoded),
            })
    return rows


def list_codex_sessions(args, cutoff) -> list[dict]:
    rows = []
    if not CODEX_SESSIONS.exists():
        return rows
    for jf in CODEX_SESSIONS.rglob("*.jsonl"):
        try:
            st = jf.stat()
        except OSError:
            continue
        if cutoff is not None and st.st_mtime <= cutoff:
            continue
        if st.st_size < args.min_bytes:
            continue
        cwd = codex_session_cwd(jf)
        if args.project and not any(p in cwd for p in args.project):
            continue
        if args.exclude_temp and TEMP_RE.search(cwd):
            continue
        rows.append({
            "tool": "codex",
            "path": str(jf),
            "folder": cwd or jf.parent.name,
            "decoded": cwd,
            "mtime": st.st_mtime,
            "mtime_iso": time.strftime("%Y-%m-%d %H:%M",
                                       time.localtime(st.st_mtime)),
            "size": st.st_size,
            "namespace_guess": guess_namespace(cwd),
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", type=float, default=None,
                    help="이 epoch 이후 수정된 세션만 (증분 워터마크)")
    ap.add_argument("--days", type=int, default=None,
                    help="최근 N 일 이내 수정된 세션만")
    ap.add_argument("--project", action="append", default=[],
                    help="폴더명(또는 codex cwd)에 이 문자열이 든 프로젝트만 (반복 가능)")
    ap.add_argument("--min-bytes", type=int, default=0,
                    help="이 크기 미만 세션 제외")
    ap.add_argument("--exclude-temp", action="store_true",
                    help="temp/skillopt/worktree 경로 제외")
    ap.add_argument("--tool", choices=["claude", "codex", "both"], default="both",
                    help="세션 소스 선택 (기본: 둘 다)")
    args = ap.parse_args()

    cutoff = None
    if args.since is not None:
        cutoff = args.since
    elif args.days is not None:
        cutoff = time.time() - args.days * 86400

    rows = []
    if args.tool in ("claude", "both"):
        rows += list_claude_sessions(args, cutoff)
    if args.tool in ("codex", "both"):
        rows += list_codex_sessions(args, cutoff)

    rows.sort(key=lambda r: r["mtime"], reverse=True)
    sys.stdout.write(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
