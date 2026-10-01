#!/usr/bin/env python3
"""Read-only migration proposals. No Memory writes and no automatic merge.

Run --help for input and output options. Reports contain private metadata:
keep them outside repositories. Standard output contains aggregate counts only.
"""

import argparse
from collections import Counter
from datetime import date, datetime, timezone
import hashlib
import html
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata


CLASSES = ("IMPORT_MEMORY", "IMPORT_DOCUMENT", "IMPORT_SOURCE", "SKIP", "REVIEW_REQUIRED")
VERDICTS = ("NEW", "DUPLICATE", "CONFLICT", "STALE")
COLLECTIONS = ("core", "career", "learning", "health", "finance", "home", "identity")
CAREER_KEYS = ("career-status", "position-preferences", "application-state", "learning-interests")
PUBLIC_PREFERENCES = {
    "work-style", "tech-stack-preferences", "information-interface-preferences",
    "testing-philosophy", "repo-work-style-analysis",
}
DOMAIN_TERMS = {
    "career": r"career|position|resume|application|이직|커리어|경력|지원서|취업",
    "learning": r"learning|study|학습|공부|학업",
    "health": r"health|knee|screening|건강|무릎|검진|상담|치료",
    "finance": r"finance|investment|budget|재무|투자|금융|자산|예산",
    "home": r"home|infra|server|홈|인프라|서버",
    "identity": r"identity|인적|신원|개인정보",
}
PII_PATTERN = re.compile(
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b\d{2,3}[- ]\d{3,4}[- ]\d{4}\b|"
    r"생년월일|주민등록|거주지|혈압|혈당|연봉|\d[\d,]*\s*(?:만원|억원|mg/dL|mmHg)"
)
INFRA_PATTERN = re.compile(
    r"https?://(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)|"
    r"\b(?:docker\s+(?:run|exec)|ssh\s+|password\s*[:=]|token\s*[:=])", re.I
)
LINK_PATTERN = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|\[[^\]]*\]\(([^)]+)\)")


class AnalyzerError(Exception):
    """Fixed messages only: exceptions must not reveal source paths or values."""


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def digest(value):
    return hashlib.sha256(normalized(value).encode("utf-8")).hexdigest()


def valid_date(value):
    text = str(value or "").strip()
    if re.fullmatch(r"\d{8}", text):
        text = f"{text[:4]}-{text[4:6]}-{text[6:]}"
    if not re.match(r"^\d{4}-\d{2}-\d{2}(?:$|[T ])", text):
        return None
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        return None


def parse_frontmatter(text):
    """Read top-level scalar fields; never execute YAML tags or expressions.

    Arrays and nested metadata are not used as scalar classification evidence.
    An unterminated or ambiguous decision field requires manual review.
    """
    if not text.startswith("---\n"):
        return {}, text, False, False
    match = re.match(r"^---\n(.*?)\n---(?:\n|$)", text, re.S)
    if not match:
        return {}, text, True, True
    fields = {}
    ambiguous = False
    decision_fields = {"collection", "sensitivity", "document_key", "role", "stale_after"}
    for line in match[1].splitlines():
        field = re.match(r"^([A-Za-z_][\w-]*):\s*(.*?)\s*$", line)
        if not field:
            continue
        key, value = field.groups()
        if key in fields:
            ambiguous = True
        if value.startswith(("|", ">", "[", "{", "!", "&", "*")):
            if key in decision_fields:
                ambiguous = True
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = re.split(r"\s+#", value, maxsplit=1)[0]
        fields[key] = value
    return fields, text[match.end():], True, ambiguous


def content_only(body):
    # Backlinks and source lists describe relationships, not conflicting facts.
    return re.split(r"^##\s+(?:Sources|관련 개념|관련 문서|Concepts)\s*$", body,
                    maxsplit=1, flags=re.M)[0].strip()


def git_date(root, relative):
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "log", "-1", "--format=%cs", "--", relative],
            capture_output=True, text=True, timeout=5, check=False,
        )
        if result.returncode == 0:
            return valid_date(result.stdout.strip())
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def source_date(fields, area, path, root):
    keys = ["source_date", "event_date", "published", "upload_date"]
    keys.extend(["collected", "collected_at"] if area == "raw" else ["updated"])
    keys.extend(["date", "created"])
    for key in keys:
        found = valid_date(fields.get(key))
        if found:
            return found, key
    filename_date = re.match(r"^(\d{4}-\d{2}-\d{2})", path.name)
    if filename_date and valid_date(filename_date[1]):
        return filename_date[1], "filename"
    committed = git_date(root, path.relative_to(root).as_posix())
    if committed:
        return committed, "git_commit"
    return None, "확인 못 함"


def domains(value):
    return {key for key, pattern in DOMAIN_TERMS.items() if re.search(pattern, value, re.I)}


def scan(root, namespace):
    if not root.is_dir():
        raise AnalyzerError("입력 루트를 읽을 수 없습니다.")
    items = []
    excluded = Counter()
    for area in ("wiki", "raw"):
        base = root / area
        if base.is_symlink():
            raise AnalyzerError("입력의 심볼릭 링크는 허용하지 않습니다.")
        if not base.exists():
            continue
        for directory, dirs, files in os.walk(base, followlinks=False):
            directory = Path(directory)
            if any((directory / name).is_symlink() for name in dirs + files):
                raise AnalyzerError("입력의 심볼릭 링크는 허용하지 않습니다.")
            dirs[:] = sorted(name for name in dirs if not name.startswith("."))
            for name in sorted(files):
                path = directory / name
                if name in {"INDEX.md", "log.md", "README.md", "CLAUDE.md", ".gitkeep"}:
                    excluded["navigation"] += 1
                    continue
                if path.suffix.lower() not in {".md", ".txt", ".pdf"}:
                    excluded["non_knowledge"] += 1
                    continue
                binary = path.suffix.lower() == ".pdf"
                try:
                    text = "" if binary else path.read_text(encoding="utf-8").replace("\r\n", "\n")
                except (OSError, UnicodeError):
                    raise AnalyzerError("지식 파일을 읽을 수 없습니다.") from None
                fields, body, has_fm, ambiguous = parse_frontmatter(text)
                if fields.get("role") == "navigation":
                    excluded["navigation"] += 1
                    continue
                heading = re.search(r"^#\s+(.+)$", body, re.M)
                title = fields.get("title") or (heading[1] if heading else path.stem)
                relative = path.relative_to(root).as_posix()
                dated, origin = source_date(fields, area, path, root)
                content = content_only(body)
                links = [a or b for a, b in LINK_PATTERN.findall(body)]
                sensitive = namespace == "private" or ambiguous or bool(PII_PATTERN.search(text))
                sensitive = sensitive or fields.get("sensitivity", "").lower() not in {"", "normal", "public"}
                identity = bool(re.search(r"application.*profile|지원서.*프로필|인적사항", relative + " " + title, re.I))
                topic_domains = domains(relative + " " + title)
                explicit_collection = fields.get("collection")
                collection = "identity" if identity else next(
                    (key for key in COLLECTIONS if key in topic_domains), "core"
                )
                if explicit_collection in COLLECTIONS:
                    collection = explicit_collection
                key = fields.get("document_key") or re.sub(r"^\d{4}-\d{2}-\d{2}[-_]", "", path.stem)
                items.append({
                    "namespace": namespace, "area": area, "source_ref": relative,
                    "source_type": "brain", "source_date": dated, "source_date_origin": origin,
                    "title": title, "collection": collection, "entry_type": None,
                    "retrieval": "SEARCH", "sensitivity": "SENSITIVE" if sensitive else "NORMAL",
                    "document_key": None, "classification": None, "rule": None, "reason": None,
                    "verdict": "NEW", "brain_comparison": [],
                    "career_comparison": [], "memory_comparison": {"status": "대상 없음"},
                    "summary": "" if sensitive else normalized(content)[:180],
                    "_fields": fields, "_body": content, "_has_fm": has_fm,
                    "_ambiguous": ambiguous, "_binary": binary, "_links": links,
                    "_key": key, "_domains": topic_domains, "_identity": identity,
                    "_infra": bool(INFRA_PATTERN.search(text)),
                    "_hash": digest(title + "\n" + content) if not binary else None,
                })
    return items, excluded


def resolve_links(items):
    """Resolve only unique targets; namespace-local links win over public ones."""
    indexed = {}
    for index, item in enumerate(items):
        indexed.setdefault((item["namespace"], Path(item["source_ref"]).stem), []).append(index)
    edges = set()
    for index, item in enumerate(items):
        for target in item["_links"]:
            target = target.split("#")[0].strip()
            if not target or "://" in target:
                continue
            stem = Path(target).stem
            namespace = item["namespace"]
            matches = indexed.get((namespace, stem), [])
            if not matches and namespace == "private":
                matches = indexed.get(("public", stem), [])
            if len(matches) == 1 and matches[0] != index:
                # Paths in Sources must match, not just share a filename.
                if "raw/" in target:
                    resolved = os.path.normpath(str(Path(item["source_ref"]).parent / target))
                    if resolved != items[matches[0]]["source_ref"]:
                        continue
                edges.add(tuple(sorted((index, matches[0]))))
    return edges


def classify(item, compiled_raw):
    fields = item["_fields"]
    private = item["namespace"] == "private"
    raw = item["area"] == "raw"
    stem = Path(item["source_ref"]).stem
    hub = item["area"] == "wiki" and len(item["_links"]) >= 3 and bool(
        re.search(r"current|현재|현황.*모음|종합", stem + " " + item["title"], re.I)
    )
    overlaps = len(item["_domains"] - {"identity"}) > 1
    rule, classification, reason = 0, "REVIEW_REQUIRED", "규칙에 맞는 근거가 부족함"
    if item["_ambiguous"]:
        rule, reason = 2, "메타데이터를 안전하게 해석할 수 없어 확인 필요"
    elif fields.get("sensitivity") == "highly-private" or (private and item["_binary"]):
        rule, reason = 2, "고민감 표시 또는 비공개 PDF: 직접 검토 필요"
    elif raw and not item["_has_fm"]:
        rule, reason = 2, "frontmatter 없는 원본: 직접 검토 필요"
    elif hub or overlaps:
        rule, reason = 2, "여러 문서의 허브 또는 두 영역에 걸친 노트"
    elif private and raw and item["collection"] == "career" and item["source_date"] and item["source_date"][5:7] == "09" and not compiled_raw:
        rule, reason = 3, "9월 커리어 원본이 위키로 정리되지 않음: Career 대조 필요"
    elif item["_identity"]:
        # Identity is a Phase 7 hold, including when a previous rule matched.
        rule, classification, reason = 10, "IMPORT_DOCUMENT", "신원 문서: Phase 7 전까지 보류"
    elif private and item["area"] == "wiki" and (stem.endswith("-status") or "goals" in stem or fields.get("stale_after")):
        rule, classification, reason = 4, "IMPORT_DOCUMENT", "개인 상태·목표·재검토 날짜를 가진 문서"
    elif not private and item["area"] == "wiki" and stem in PUBLIC_PREFERENCES:
        rule, classification, reason = 5, "IMPORT_MEMORY", "공개 개인 선호와 일하는 방식"
        item["collection"] = "core"
    elif private and item["area"] == "wiki":
        rule, classification, reason = 6, "IMPORT_DOCUMENT", "나머지 개인 위키: 문서로 검토"
        if item["_infra"] or item["collection"] == "home":
            classification, reason = "REVIEW_REQUIRED", "인프라 운영 정보가 들어가는지 확인 필요"
    elif not private:
        rule, classification, reason = 7, "SKIP", "공부 노트 저장소 유지: 공개 기술 학습 자료는 이관하지 않음"
    elif raw and re.search(r"session|harness|회고|하네스", item["source_ref"] + " " + str(fields.get("source_type", "")), re.I):
        rule, classification, reason = 9, "SKIP", "세션·하네스·저장소 작업 기록"
    elif raw and item["source_date"]:
        rule, classification, reason = 8, "IMPORT_SOURCE", "날짜를 가진 개인 원본: 출처로 보관"
    if item["_identity"]:
        item["collection"] = "identity"
        item["sensitivity"] = "SENSITIVE"
        item["summary"] = ""
        item["hold"] = "Phase 7: 암호화와 접근 검증 전까지 보류"
    entry_type = {"IMPORT_MEMORY": "MEMORY", "IMPORT_DOCUMENT": "DOCUMENT", "IMPORT_SOURCE": "SOURCE"}.get(classification)
    if classification == "REVIEW_REQUIRED":
        entry_type = "SOURCE" if raw else "DOCUMENT"
    item.update(classification=classification, rule=rule, reason=reason, entry_type=entry_type)
    if entry_type == "DOCUMENT":
        item["document_key"] = item["_key"]
    if entry_type == "SOURCE":
        item["retrieval"] = "ARCHIVE"
    elif entry_type == "MEMORY" and item["sensitivity"] == "NORMAL":
        item["retrieval"] = "ALWAYS"
    if item["sensitivity"] == "SENSITIVE":
        item["summary"] = ""
    if item["_infra"]:
        item["review_flags"] = ["운영 정보 포함 가능성: 저장 전에 직접 검토 필요"]
        item.setdefault("hold", "운영 정보 포함 여부를 확인하기 전까지 보류")


def paragraphs(body):
    return {normalized(p) for p in re.split(r"\n\s*\n", body) if len(normalized(p)) >= 40 and not p.lstrip().startswith("#")}


def compare(left, right, relation):
    same_hash = left["_hash"] and left["_hash"] == right["_hash"]
    left_body, right_body = normalized(left["_body"]), normalized(right["_body"])
    same_content = bool(left_body) and left_body == right_body
    shared = paragraphs(left["_body"]) & paragraphs(right["_body"])
    if same_hash:
        return "DUPLICATE", "정규화한 제목과 전체 본문 hash 일치"
    if same_content:
        return None, "본문은 같지만 제목이 다름: 관련 문서로 직접 검토"
    if shared:
        return None, "같은 문단이 포함됨: 부분 중복, 나머지 내용은 직접 검토"
    if relation == "source_link":
        return None, "위키와 출처의 관계: 본문이 다른 것만으로 충돌이라 판정하지 않음"
    if left_body and right_body:
        return "CONFLICT", "같은 문서 키·주제의 다른 본문: 충돌 후보, 사실값 직접 확인 필요"
    return None, "비교할 본문 없음"


def location(item):
    return {"namespace": item["namespace"], "source_ref": item["source_ref"], "source_date": item["source_date"]}


def brain_comparisons(items, edges):
    for i, left in enumerate(items):
        for j in range(i + 1, len(items)):
            right = items[j]
            linked = (i, j) in edges
            work_style = bool(re.search(r"work.style|일하는 방식|업무 방식", left["_key"] + " " + left["title"], re.I)) and bool(
                re.search(r"work.style|일하는 방식|업무 방식", right["_key"] + " " + right["title"], re.I)
            )
            same_topic = (left["_key"] == right["_key"] or normalized(left["title"]) == normalized(right["title"]) or work_style)
            same_hash = left["_hash"] and left["_hash"] == right["_hash"]
            if not (linked or same_topic or same_hash):
                continue
            relation = "source_link" if linked and left["area"] != right["area"] else "topic"
            if linked and left["area"] == right["area"] and not same_topic:
                relation = "source_link"
            verdict, reason = compare(left, right, relation)
            for current, other in ((left, right), (right, left)):
                current["brain_comparison"].append({
                    "status": verdict or "RELATED", "reason": reason, "relation": relation,
                    "left": location(current), "right": location(other),
                    "automatic_merge": False,
                })


def load_career(client_path, runtime):
    missing = [{"key": key, "status": "확인 못 함"} for key in CAREER_KEYS]
    if client_path is None:
        return missing
    adapter = Path(__file__).with_name("brain_migration_career.mjs")
    try:
        result = subprocess.run(
            [runtime, str(adapter), str(client_path.resolve())],
            capture_output=True, text=True, timeout=30, check=False,
        )
        if result.returncode != 0:
            return missing
        data = json.loads(result.stdout)
        if not isinstance(data, list):
            return missing
        by_key = {}
        for record in data:
            key = record["key"]
            if key not in CAREER_KEYS:
                continue
            document = record.get("document")
            if record.get("status") == "확인함" and isinstance(document, dict) and isinstance(document.get("body"), str):
                by_key[key] = record
        return [by_key.get(key, {"key": key, "status": "확인 못 함"}) for key in CAREER_KEYS]
    except (OSError, subprocess.TimeoutExpired, ValueError, KeyError, TypeError):
        return missing


def career_matches(item, key):
    if item["collection"] not in {"career", "learning", "identity"}:
        return False
    explicit = item["_fields"].get("career_document_key") or item["_fields"].get("document_key")
    if explicit in CAREER_KEYS:
        return explicit == key
    if item["_key"] == key:
        return True
    topic = item["_key"] + " " + item["title"]
    if key == "learning-interests":
        return bool(re.search(r"learning.*interest|study.*interest|학습.*관심|공부.*관심", topic, re.I))
    if key == "position-preferences":
        return bool(re.search(r"prefer|position.*preference|motivation|work.style|선호|이직.*동기|업무 방식|일하는 방식", topic, re.I))
    if key == "application-state":
        return bool(re.search(r"application.*(?:state|status)|지원.*(?:상태|현황)", topic, re.I))
    return bool(re.search(r"career.*(?:state|status)|커리어.*(?:상태|현황)|이직.*(?:상태|현황)", topic, re.I))


def finalize(items, career, today):
    for item in items:
        for record in career:
            key = record["key"]
            status = record["status"]
            evidence = {"document_key": key, "status": status}
            if status == "확인함":
                doc = record["document"]
                evidence.update(source_ref="career:" + key, source_date=valid_date(doc.get("updatedAt")), revision=doc.get("version"))
                if career_matches(item, key):
                    other = {"_body": doc["body"], "_hash": digest(key + "\n" + doc["body"])}
                    verdict, reason = compare(item, other, "topic")
                    evidence.update(verdict=verdict, reason=reason, automatic_merge=False, left=location(item))
                else:
                    evidence["status"] = "해당 없음"
            item["career_comparison"].append(evidence)
        statuses = {e["status"] for e in item["brain_comparison"]}
        statuses.update(e.get("verdict") for e in item["career_comparison"])
        stale_reasons = []
        expiry = valid_date(item["_fields"].get("stale_after"))
        if expiry and expiry <= today.isoformat():
            stale_reasons.append({"reason": "stale_after 지남", "date": expiry})
        for evidence in item["brain_comparison"]:
            newer = evidence["right"]["source_date"]
            if evidence["relation"] == "topic" and item["source_date"] and newer and newer > item["source_date"]:
                stale_reasons.append({"reason": "같은 주제에 더 새 출처가 있음", "newer": evidence["right"]})
        for evidence in item["career_comparison"]:
            newer = evidence.get("source_date")
            if evidence.get("verdict") and item["source_date"] and newer and newer > item["source_date"]:
                stale_reasons.append({"reason": "Career에 더 새 출처가 있음", "newer": {"source_ref": evidence["source_ref"], "source_date": newer}})
        item["stale_evidence"] = stale_reasons
        if "CONFLICT" in statuses:
            item["verdict"] = "CONFLICT"
        elif stale_reasons:
            item["verdict"] = "STALE"
        elif "DUPLICATE" in statuses:
            item["verdict"] = "DUPLICATE"
        item["verdicts"] = [value for value in VERDICTS if value in statuses or value == item["verdict"] or (value == "STALE" and stale_reasons)]


def aggregate(items, excluded):
    return {
        "total_files": len(items), "excluded": dict(excluded),
        "classification": {value: sum(i["classification"] == value for i in items) for value in CLASSES},
        "verdict": {value: sum(i["verdict"] == value for i in items) for value in VERDICTS},
        "sensitivity": {value: sum(i["sensitivity"] == value for i in items) for value in ("NORMAL", "SENSITIVE")},
        "collection": {value: sum(i["collection"] == value for i in items) for value in COLLECTIONS},
    }


def analyze(public_root, private_root, career=None, today=None):
    today = today or date.today()
    public, excluded = scan(public_root, "public")
    private, private_excluded = scan(private_root, "private")
    items = public + private
    excluded.update(private_excluded)
    edges = resolve_links(items)
    compiled = set()
    for left, right in edges:
        if items[left]["area"] != items[right]["area"]:
            compiled.add(left if items[left]["area"] == "raw" else right)
    for index, item in enumerate(items):
        classify(item, index in compiled)
    brain_comparisons(items, edges)
    career = career or load_career(None, "bun")
    finalize(items, career, today)
    return {
        "schema_version": 1, "dry_run": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "as_of": today.isoformat(), "summary": aggregate(items, excluded),
        "limitations": [
            "규칙 기반 제안이며 자동 승인·저장·병합하지 않음",
            "CONFLICT는 같은 주제의 다른 본문을 찾은 후보: 사실값 직접 확인 필요",
            "부분 중복은 RELATED로 표시하며 DUPLICATE는 제목·본문 hash가 같을 때만 판정함",
            "PDF는 본문 추출 없이 메타데이터만 분류함",
            "Memory V2 대조: 대상 없음",
        ],
        "career_read": [{"document_key": r["key"], "status": r["status"]} for r in career],
        "items": [{key: value for key, value in item.items() if not key.startswith("_")} for item in items],
    }


def render_html(report):
    esc = lambda value: html.escape(str(value), quote=True)
    summary = report["summary"]
    tables = []
    for group in ("classification", "verdict", "sensitivity", "collection"):
        rows = "".join(f"<tr><td>{esc(k)}</td><td>{v}</td></tr>" for k, v in summary[group].items())
        tables.append(f"<section><h2>{group}</h2><table>{rows}</table></section>")
    rows = []
    sensitive_locations = {
        (i["namespace"], i["source_ref"])
        for i in report["items"] if i["sensitivity"] == "SENSITIVE"
    }
    for item in report["items"]:
        # Sensitive rows contain only the title; JSON owns their review details.
        if item["sensitivity"] == "SENSITIVE":
            rows.append(f'<tr><td colspan="6">{esc(item["title"])}</td></tr>')
            continue
        short = item["summary"]
        brain_evidence = []
        for comparison in item["brain_comparison"]:
            other = comparison["right"]
            if (other["namespace"], other["source_ref"]) in sensitive_locations:
                brain_evidence.append({"status": comparison["status"], "reason": "민감 문서와의 대조 근거는 JSON에서 확인"})
            else:
                brain_evidence.append(comparison)
        stale_evidence = []
        for evidence in item["stale_evidence"]:
            newer = evidence.get("newer", {})
            if (newer.get("namespace"), newer.get("source_ref")) in sensitive_locations:
                stale_evidence.append({"reason": "민감 문서와의 날짜 대조는 JSON에서 확인"})
            else:
                stale_evidence.append(evidence)
        evidence = json.dumps({
            "brain": brain_evidence, "career": item["career_comparison"],
            "stale": stale_evidence, "hold": item.get("hold"),
            "review_flags": item.get("review_flags", []),
        }, ensure_ascii=False, indent=2)
        rows.append(
            f'<tr><td>{esc(item["title"])}<p>{esc(short)}</p></td>'
            f'<td>{esc(item["namespace"])}/{esc(item["source_ref"])}</td>'
            f'<td>{esc(item["classification"])}<p>규칙 {item["rule"]}: {esc(item["reason"])}</p></td>'
            f'<td>{esc(item["collection"])} / {esc(item["entry_type"])}<p>{esc(item["retrieval"])} / {esc(item["sensitivity"])}</p><p>{esc(item["document_key"])}</p></td>'
            f'<td>{esc(item["source_date"])}<p>{esc(item["source_date_origin"])}</p></td>'
            f'<td>{esc(item["verdict"])}<details><summary>대조 근거</summary><pre>{esc(evidence)}</pre></details></td></tr>'
        )
    limitations = "".join(f"<li>{esc(text)}</li>" for text in report["limitations"])
    career = "".join(f'<li>{esc(r["document_key"])}: {esc(r["status"])}</li>' for r in report["career_read"])
    return (
        '<!doctype html><html lang="ko"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">'
        '<title>brain 이관 검토 보고서</title><style>'
        'body{font:15px system-ui;margin:24px;color:#17212b;background:#fafafa}'
        '.counts{display:flex;gap:24px;flex-wrap:wrap}table{border-collapse:collapse;width:100%;background:white}'
        'th,td{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}'
        'pre{white-space:pre-wrap;overflow-wrap:anywhere}td{overflow-wrap:anywhere}p{margin:.4em 0;color:#465569}'
        '</style><h1>brain 이관 검토 보고서</h1>'
        f'<p>지식 파일 {summary["total_files"]}개 · 기준일 {esc(report["as_of"])} · 저장·병합 없음</p>'
        f'<div class="counts">{"".join(tables)}</div><h2>검토 한계</h2><ul>{limitations}</ul>'
        '<p>SENSITIVE 항목은 제목만 표시합니다. 세부 위치와 대조 근거는 0600 JSON 보고서에서 확인합니다.</p>'
        f'<h2>Career 조회</h2><ul>{career}</ul>'
        '<h2>파일별 제안</h2><table><thead><tr><th>제목·요약</th><th>위치</th><th>분류·사유</th>'
        '<th>제안 속성</th><th>출처 날짜</th><th>판정</th></tr></thead><tbody>'
        + "".join(rows) + '</tbody></table></html>'
    )


def ensure_output_directory(output, roots):
    # Reject symlink components and any repository, including nested private Git.
    absolute = output.expanduser().absolute()
    for ancestor in [absolute, *absolute.parents]:
        if ancestor.is_symlink():
            raise AnalyzerError("출력 경로의 심볼릭 링크는 허용하지 않습니다.")
    resolved = absolute.resolve()
    for root in roots:
        if resolved == root or root in resolved.parents:
            raise AnalyzerError("보고서는 입력 저장소 밖에 작성해야 합니다.")
    for parent in [resolved, *resolved.parents]:
        if not (parent / ".git").exists():
            continue
        # A home-directory dotfiles repository can ignore the suggested local
        # data directory. This does not permit reports inside project repos.
        ignored_home_data = False
        if parent == Path.home().resolve():
            check = subprocess.run(
                ["git", "-C", str(parent), "check-ignore", "-q", str(resolved)],
                capture_output=True, timeout=5, check=False,
            )
            ignored_home_data = check.returncode == 0
        if not ignored_home_data:
            raise AnalyzerError("보고서는 git 저장소 밖에 작성해야 합니다.")
    if resolved.exists() and (not resolved.is_dir() or resolved.stat().st_mode & 0o077):
        raise AnalyzerError("기존 출력 디렉터리는 권한 0700이어야 합니다.")
    resolved.mkdir(parents=True, exist_ok=True, mode=0o700)
    return resolved


def secure_write(path, content):
    if path.is_symlink():
        raise AnalyzerError("출력 파일의 심볼릭 링크는 허용하지 않습니다.")
    fd, temporary = tempfile.mkstemp(prefix=".report-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_reports(report, output):
    secure_write(output / "report.json", json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    secure_write(output / "report.html", render_html(report))
    rows = []
    for group in ("classification", "verdict", "sensitivity", "collection"):
        for key, count in report["summary"][group].items():
            rows.append(f"| {group} | {key} | {count} |")
    readme = (
        "# brain 이관 보고서\n\n"
        f'기준일은 {report["as_of"]}이며 지식 파일 {report["summary"]["total_files"]}개를 읽었다.\n'
        "원본과 대상 시스템에는 쓰지 않았다.\n\n"
        "| 집계 | 항목 | 파일 수 |\n| --- | --- | --- |\n" + "\n".join(rows)
        + "\n\n[HTML 보고서](report.html)와 [JSON 보고서](report.json)를 검토한다.\n"
        "CONFLICT는 자동 병합하지 않으며 날짜와 위치를 비교해 직접 확인한다.\n"
        "Career를 읽지 못한 경우 확인 못 함으로 표시하며 Memory V2 대조는 대상 없음이다.\n"
        "이 파일들은 모두 0600 권한이며 저장소에 넣지 않는다.\n"
        "\n## 실행 방법\n\n"
        "```bash\npython3 scripts/brain_migration_analyzer.py \\\n"
        "  --public-root <public-root> \\\n"
        "  --private-root <private-root> \\\n"
        "  --output-dir <outside-repositories> \\\n"
        "  --career-client <career-os>/scripts/candidate-context/client.ts\n```\n\n"
        "Career 클라이언트는 기존 읽기 경로로 GET만 호출한다.\n"
        "연결 설정은 `CAREER_BACKEND_URL`과 `CAREER_BACKEND_TOKEN_FILE` 환경 변수로 받는다.\n"
        "직접 토큰을 받는 `CAREER_BACKEND_TOKEN`은 토큰 파일 환경 변수와 함께 설정하지 않는다.\n"
        "값과 실제 토큰 위치는 이 보고서나 공개 저장소에 적지 않는다.\n"
        "Career 4문서가 FOS로 이관된 뒤에는 FOS 대조로 대신한다.\n"
        "현재 FOS 대조는 API가 없어 대상 없음으로 표시한다.\n"
    )
    secure_write(output / "README.md", readme)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-root", type=Path, required=True)
    parser.add_argument("--private-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path.home() / ".local/share/fos-brain-migration")
    parser.add_argument("--career-client", type=Path, help="Installed candidate-context/client.ts; GET only")
    parser.add_argument("--career-runtime", default="bun")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    args = parser.parse_args(argv)
    try:
        roots = [args.public_root.resolve(), args.private_root.resolve()]
        if roots[0] == roots[1]:
            raise AnalyzerError("공개와 비공개 입력 루트는 달라야 합니다.")
        output = ensure_output_directory(args.output_dir, roots)
        career = load_career(args.career_client, args.career_runtime)
        report = analyze(*roots, career=career, today=args.as_of)
        write_reports(report, output)
        print(json.dumps({"summary": report["summary"], "report_pattern": "<output-dir>/report.{json,html}", "readme_pattern": "<output-dir>/README.md"}, ensure_ascii=False))
        return 0
    except AnalyzerError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError):
        print("분석을 완료하지 못했습니다. 입력과 출력 권한을 확인하십시오.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
