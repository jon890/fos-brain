#!/usr/bin/env python3
"""brain-add 문서를 공용 Memory Atlas 문서 미리보기로 생성한다.

brain-curate와 같은 템플릿을 사용해 실제 Quartz 문서 화면의 색, 글꼴과 읽기 폭을
한 곳에서 관리한다. 이 생성기는 신규·보강 Markdown을 공용 데이터 계약으로 바꾸는
brain-add 전용 변환기만 소유한다.

사용 예:
    python3 <skill-dir>/scripts/generate_preview.py \
        --ns public \
        --title "하네스 지식 강화 — 3 페이지" \
        --summary "신규 3개 + ai-harness-pattern 허브 백링크 보강" \
        --new /tmp/custom-domain-agent.md /tmp/pitfalls-file-per-pattern.md \
        --update /tmp/ai-harness-pattern.md \
        --known-from ~/personal/fos-brain/wiki \
        --out /tmp/brain-preview.html
    생성 뒤 현재 실행 환경의 브라우저 제어 수단으로 연다.

주의: 페이지 본문에 '</script>' 문자열이 있으면 공용 템플릿 주입이 깨지므로 거부한다.
"""

import argparse
import json
import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).parents[3]
TEMPLATE = PLUGIN_ROOT / "skills" / "brain-curate" / "templates" / "preview.html"

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


def preview_page(ns: str, status: str, path: Path) -> dict[str, str]:
    """페이지 1개를 공용 Memory Atlas preview page 계약으로 바꾼다."""
    text = path.read_text(encoding="utf-8")
    if "</script>" in text.lower():
        raise SystemExit(f"오류: {path} 에 '</script>' 가 있어 미리보기가 깨진다.")
    fm, body = split_frontmatter(text)
    ptype = fm.get("type", "concept")
    status_label = {"new": "신규", "update": "보강"}.get(status, status)
    metadata = [ns, status_label, ptype]
    metadata.extend(f"{key} {fm[key]}" for key in ("created", "updated") if key in fm)
    metadata.append(brain_path(path.stem, ptype))
    return {
        "frontmatter": " · ".join(metadata),
        "markdown": body,
        "slug": path.stem,
        "title": first_h1(body),
        "status": status,
    }


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
    ap.add_argument("--ns", default="public", choices=["public", "private"])
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

    pages = []
    for status, paths in (("new", args.new), ("update", args.update)):
        for raw in paths:
            pages.append(preview_page(args.ns, status, Path(raw).expanduser()))

    data = {
        "title": args.title,
        "summary": args.summary,
        "stats": {
            "신규": {"n": len(args.new), "kind": "new"},
            "보강": {"n": len(args.update), "kind": "augment"},
        },
        "pages": pages,
        "knownSlugs": known_slugs(args.known_from),
        "copy": {
            "navBrand": "FOS / MEMORY · BRAIN ADD",
            "railTitle": "지식 통합 미리보기",
            "railNote": "원본을 저장하기 전에 신규·보강 문서와 연결을 확인합니다.",
            "heroKicker": "BRAIN ADD / BEFORE WRITE",
            "heroSummary": args.summary,
            "pageHint": "현재 Memory Atlas 문서 화면과 같은 시각 언어로 신규·보강 문서를 읽습니다.",
        },
    }
    raw_data = json.dumps(data, ensure_ascii=False)
    out = TEMPLATE.read_text(encoding="utf-8").replace("__DATA__", raw_data)
    Path(args.out).expanduser().write_text(out, encoding="utf-8")
    print(f"생성 완료: {args.out} (페이지 {len(pages)}개)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
