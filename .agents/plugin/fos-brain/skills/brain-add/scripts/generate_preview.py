#!/usr/bin/env python3
"""brain(fos-brain) wiki 페이지 미리보기 HTML 생성기.

brain 페이지는 마크다운 본문 + frontmatter(type/created/updated) + [[wikilink]] 백링크
그래프가 핵심이다. 등록(brain-add) 전에 그 페이지들이 실제로 어떻게 보일지, 어떤 백링크를
거는지, 그 백링크 대상이 이미 brain 에 있는지(없으면 신규 생성 예정)를 한눈에 검토하려고
github-markdown-css + marked.js 템플릿에 여러 페이지를 카드 스택으로 흘려 넣는다.

Dooray·GitHub 미리보기(~/.claude/templates/{dooray,github}-preview/) 와 같은 구조 —
viewer 는 같고 brain 도메인(frontmatter 배지·wikilink 강조·신규/보강 표시)만 더했다.

사용 예:
    python3 ~/.claude/skills/brain-add/scripts/generate_preview.py \
        --ns public \
        --title "하네스 지식 강화 — 3 페이지" \
        --summary "신규 3개 + ai-harness-pattern 허브 백링크 보강" \
        --new /tmp/custom-domain-agent.md /tmp/pitfalls-file-per-pattern.md \
        --update /tmp/ai-harness-pattern.md \
        --known-from ~/personal/fos-brain/wiki \
        --out /tmp/brain-preview.html
    cmux browser open "file:///tmp/brain-preview.html"

주의:
- 페이지 본문에 '</script>' 문자열이 있으면 안 된다 (marked 소스 블록이 깨진다).
- CDN 로드라 오프라인에서는 스타일이 빠진 채 보인다.
- 🔗 배지는 [[wikilink]] 다. 빨간 배지는 --known-from 디렉터리에 해당 slug 파일이 없는
  대상 — 이번에 새로 만들 페이지이거나 오타다. 등록 후 실제 백링크는 brain 에서 확인.
"""

import argparse
import html
import json
import sys
from pathlib import Path

TEMPLATE = Path(__file__).parent.parent / "templates" / "preview.html"

TYPE_DIR = {"concept": "concepts", "entity": "entities", "topic": "topics"}


def split_frontmatter(text: str) -> tuple[dict, str]:
    """`--- ... ---` frontmatter 를 dict 로, 나머지를 본문으로 가른다."""
    fm: dict[str, str] = {}
    body = text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            for line in text[3:end].strip().splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    fm[k.strip()] = v.strip()
            body = text[end + 4:].lstrip("\n")
    return fm, body


def first_h1(body: str) -> str:
    for line in body.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return "(제목 없음)"


def brain_path(stem: str, ptype: str) -> str:
    return f"wiki/{TYPE_DIR.get(ptype, 'concepts')}/{stem}.md"


def card(idx: int, ns: str, status: str, path: Path) -> tuple[str, str]:
    """페이지 1개 → (헤더+본문 카드 HTML, marked 소스 script)."""
    text = path.read_text(encoding="utf-8")
    if "</script>" in text:
        raise SystemExit(f"오류: {path} 에 '</script>' 가 있어 미리보기가 깨진다.")
    fm, body = split_frontmatter(text)
    title = first_h1(body)
    ptype = fm.get("type", "concept")
    status_label = {"new": "신규", "update": "보강"}.get(status, status)
    dates = " · ".join(
        f"{k} {fm[k]}" for k in ("created", "updated") if k in fm
    )
    head = f"""  <article class="page">
    <div class="page-head">
      <div class="badges">
        <span class="badge ns-{ns}">{html.escape(ns)}</span>
        <span class="badge status-{status}">{status_label}</span>
        <span class="badge type">{html.escape(ptype)}</span>
        <span class="dates">{html.escape(dates)}</span>
      </div>
      <div class="path">{html.escape(brain_path(path.stem, ptype))}</div>
      <h2>{html.escape(title)}</h2>
    </div>
    <div class="markdown-body" id="md-{idx}">렌더링 중…</div>
  </article>"""
    src = f'<script type="text/markdown" data-target="md-{idx}">{body}</script>'
    return head, src


def known_slugs(roots: list[str]) -> list[str]:
    slugs: set[str] = set()
    for root in roots:
        p = Path(root).expanduser()
        if p.is_dir():
            for f in p.rglob("*.md"):
                slugs.add(f.stem)
    return sorted(slugs)


def main() -> int:
    ap = argparse.ArgumentParser(description="brain wiki 페이지 미리보기 HTML 생성")
    ap.add_argument("--ns", default="public", choices=["public", "private", "work"])
    ap.add_argument("--title", default="brain 미리보기")
    ap.add_argument("--summary", default="")
    ap.add_argument("--new", nargs="*", default=[], help="신규 생성 페이지 .md 경로")
    ap.add_argument("--update", nargs="*", default=[], help="기존 보강 페이지 .md 경로")
    ap.add_argument(
        "--known-from", nargs="*", default=[],
        help="기존 slug 판정용 wiki 디렉터리 (백링크 대상 존재 여부 표시)",
    )
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if not args.new and not args.update:
        print("오류: --new 또는 --update 로 페이지를 최소 1개 지정하라.", file=sys.stderr)
        return 1

    heads, srcs = [], []
    idx = 0
    for status, paths in (("new", args.new), ("update", args.update)):
        for raw in paths:
            head, src = card(idx, args.ns, status, Path(raw).expanduser())
            heads.append(head)
            srcs.append(src)
            idx += 1

    out = (
        TEMPLATE.read_text(encoding="utf-8")
        .replace("{{TITLE}}", html.escape(args.title))
        .replace("{{SUMMARY}}", html.escape(args.summary))
        .replace("{{KNOWN_SLUGS}}", json.dumps(known_slugs(args.known_from)))
        .replace("{{CARDS}}", "\n".join(heads) + "\n" + "\n".join(srcs))
    )
    Path(args.out).expanduser().write_text(out, encoding="utf-8")
    print(f"생성 완료: {args.out} (페이지 {idx}개)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
