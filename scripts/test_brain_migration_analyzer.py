"""Synthetic fixtures only. No real private filenames, titles or values."""

from contextlib import redirect_stderr, redirect_stdout
from datetime import date
import importlib.util
import io
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("brain_migration_analyzer.py")
SPEC = importlib.util.spec_from_file_location("analyzer", SCRIPT)
analyzer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(analyzer)


class MigrationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="brain-analyzer-", dir="/tmp")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.public = self.root / "public"
        self.private = self.root / "personal"
        self.public.mkdir()
        self.private.mkdir()

    def write(self, relative, body="Synthetic knowledge only.", fields=None, private=False):
        root = self.private if private else self.public
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if fields is not None:
            front = "\n".join(f"{key}: {value}" for key, value in fields.items())
            body = f"---\n{front}\n---\n{body}"
        path.write_text(body, encoding="utf-8")
        return path

    def report(self, career=None):
        return analyzer.analyze(self.public, self.private, career=career, today=date(2026, 10, 2))

    def test_rule_order_and_proposals(self):
        self.write("wiki/topics/work-style.md", fields={"created": "2026-10-01"})
        self.write("wiki/concepts/synthetic-study.md", fields={"created": "2026-10-01"})
        self.write("raw/notes/bare.md")
        self.write("wiki/topics/health-demo-status.md", fields={"updated": "2026-10-01"}, private=True)
        self.write("raw/web/dated-example.md", fields={"collected": "2026-09-01"}, private=True)
        self.write("raw/notes/session-example.md", fields={"collected": "2026-09-01"}, private=True)
        self.write("raw/notes/position-demo.md", fields={"collected": "2026-09-01"}, private=True)
        self.write("wiki/topics/synthetic-secret.md", fields={"sensitivity": "highly-private"}, private=True)
        self.write("wiki/topics/synthetic-application-profile.md", fields={"created": "2026-10-01"}, private=True)
        self.write("wiki/entities/home-example.md", fields={"created": "2026-10-01"}, private=True)
        self.write("raw/papers/demo.pdf", private=True)
        report = self.report()
        rules = {Path(i["source_ref"]).stem: i for i in report["items"]}
        expected = {
            "work-style": (5, "IMPORT_MEMORY"), "synthetic-study": (7, "SKIP"),
            "bare": (2, "REVIEW_REQUIRED"), "health-demo-status": (4, "IMPORT_DOCUMENT"),
            "dated-example": (8, "IMPORT_SOURCE"), "session-example": (9, "SKIP"),
            "position-demo": (3, "REVIEW_REQUIRED"), "synthetic-secret": (2, "REVIEW_REQUIRED"),
            "synthetic-application-profile": (10, "IMPORT_DOCUMENT"),
            "home-example": (6, "REVIEW_REQUIRED"), "demo": (2, "REVIEW_REQUIRED"),
        }
        for key, (rule, classification) in expected.items():
            with self.subTest(key=key):
                self.assertEqual(rules[key]["rule"], rule)
                self.assertEqual(rules[key]["classification"], classification)
        self.assertEqual(rules["work-style"]["retrieval"], "ALWAYS")
        self.assertEqual(rules["dated-example"]["retrieval"], "ARCHIVE")
        self.assertEqual(rules["synthetic-application-profile"]["collection"], "identity")
        self.assertIn("Phase 7", rules["synthetic-application-profile"]["hold"])

    def test_hub_overlap_and_navigation(self):
        self.write("wiki/topics/current-demo.md", "# Current overview\n[[one]] [[two]] [[three]]", fields={"updated": "2026-10-01"}, private=True)
        self.write("wiki/topics/health-finance-example.md", fields={"updated": "2026-10-01"}, private=True)
        self.write("wiki/custom.md", fields={"role": "navigation"})
        self.write("wiki/INDEX.md")
        self.write("raw/demo.vtt")
        report = self.report()
        self.assertEqual(report["summary"]["total_files"], 2)
        self.assertEqual(report["summary"]["classification"]["REVIEW_REQUIRED"], 2)
        self.assertEqual(report["summary"]["excluded"], {"navigation": 2, "non_knowledge": 1})

    def test_source_dates_and_no_mtime_fallback(self):
        path = self.write("raw/notes/2026-01-01-demo.md", fields={
            "source_date": "invalid", "event_date": "2026-02-03", "published": "2026-03-04", "created": "2026-04-05",
        })
        fields, _, _, _ = analyzer.parse_frontmatter(path.read_text())
        self.assertEqual(analyzer.source_date(fields, "raw", path, self.public), ("2026-02-03", "event_date"))
        self.assertEqual(analyzer.source_date({"upload_date": "20260109"}, "raw", path, self.public), ("2026-01-09", "upload_date"))
        self.assertEqual(analyzer.source_date({"collected_at": "2026-06-01T03:00:00Z", "updated": "2026-07-01"}, "raw", path, self.public), ("2026-06-01", "collected_at"))
        self.assertEqual(analyzer.source_date({"collected": "2026-06-01", "updated": "2026-07-01"}, "wiki", path, self.public), ("2026-07-01", "updated"))
        undated = self.write("raw/notes/undated.md")
        self.assertEqual(analyzer.source_date({}, "raw", undated, self.public), (None, "확인 못 함"))
        self.assertIsNone(analyzer.valid_date("2026-02-31"))

    def test_duplicate_conflict_stale_and_source_relations(self):
        self.write("wiki/topics/demo.md", "# Demo\n\nUnchanged synthetic body.", fields={"updated": "2026-01-01"})
        self.write("raw/notes/demo-copy.md", "# Demo\n\nUnchanged synthetic body.", fields={"collected": "2026-01-01"})
        self.write("wiki/topics/health-example.md", "# Synthetic health\n\nA synthetic first value.", fields={"updated": "2026-01-01"}, private=True)
        self.write("raw/notes/health-example.md", "# Synthetic health\n\nA synthetic second value.", fields={"collected": "2026-02-01"}, private=True)
        self.write("wiki/topics/old-demo.md", fields={"stale_after": "2026-01-01", "updated": "2025-01-01"}, private=True)
        self.write("raw/notes/position-linked.md", fields={"collected": "2026-09-01"}, private=True)
        self.write("wiki/topics/career-example.md", "# Career example\n\nCompiled synthetic summary.\n\n## Sources\n[[../../raw/notes/position-linked.md]]", fields={"updated": "2026-09-01"}, private=True)
        report = self.report()
        items = {i["source_ref"]: i for i in report["items"]}
        self.assertEqual(items["wiki/topics/demo.md"]["verdict"], "DUPLICATE")
        conflict = items["wiki/topics/health-example.md"]
        self.assertEqual(conflict["verdict"], "CONFLICT")
        self.assertIn("STALE", conflict["verdicts"])
        self.assertEqual(conflict["brain_comparison"][0]["right"]["source_date"], "2026-02-01")
        self.assertFalse(conflict["brain_comparison"][0]["automatic_merge"])
        self.assertEqual(items["wiki/topics/old-demo.md"]["verdict"], "STALE")
        self.assertEqual(items["raw/notes/position-linked.md"]["rule"], 8)
        self.assertEqual(items["raw/notes/position-linked.md"]["brain_comparison"][0]["status"], "RELATED")

    def test_cross_namespace_work_style_and_partial_hub_duplicates(self):
        paragraph = "A wholly synthetic statement about working preferences for fixture use only."
        self.write("wiki/topics/work-style.md", "# Work style\n\n" + paragraph, fields={"updated": "2026-01-01"})
        self.write("wiki/topics/work-style-example.md", "# Work style example\n\nA different synthetic statement.", fields={"updated": "2026-03-01"}, private=True)
        self.write("wiki/topics/current-demo.md", "# Current overview\n\n" + paragraph + "\n\n[[work-style]] [[x]] [[y]]", fields={"updated": "2026-03-01"})
        report = self.report()
        public_style = next(i for i in report["items"] if i["source_ref"] == "wiki/topics/work-style.md")
        self.assertEqual(public_style["verdict"], "CONFLICT")
        self.assertTrue(any(e["right"]["namespace"] == "private" for e in public_style["brain_comparison"]))
        self.assertTrue(any(e["status"] == "RELATED" and "부분 중복" in e["reason"] for e in public_style["brain_comparison"]))

    def test_sensitive_redaction_html_escape_and_stdout(self):
        secret = "UNIQUE_SYNTHETIC_SECRET_BODY_MARKER"
        self.write("wiki/topics/private-demo.md", "# Synthetic title\n\n" + secret, fields={"updated": "2026-01-01"}, private=True)
        self.write("wiki/topics/html-demo.md", "# <script>synthetic</script>\n\nordinary body", fields={"updated": "2026-01-01"})
        self.write("wiki/topics/work-style.md", "# Work style\n\nMail: demo@example.invalid", fields={"updated": "2026-01-01"})
        report = self.report()
        encoded = json.dumps(report)
        rendered = analyzer.render_html(report)
        self.assertNotIn(secret, encoded)
        self.assertNotIn(secret, rendered)
        self.assertNotIn("private-demo.md", rendered)
        self.assertNotIn("wiki/topics/private-demo", rendered)
        self.assertNotIn("<script>synthetic</script>", rendered)
        self.assertIn("&lt;script&gt;synthetic&lt;/script&gt;", rendered)
        item = next(i for i in report["items"] if i["source_ref"].endswith("work-style.md"))
        self.assertEqual(item["sensitivity"], "SENSITIVE")
        self.assertEqual(item["retrieval"], "SEARCH")
        output = self.root / "reports"
        captured = io.StringIO()
        with redirect_stdout(captured):
            code = analyzer.main(["--public-root", str(self.public), "--private-root", str(self.private), "--output-dir", str(output)])
        self.assertEqual(code, 0)
        self.assertNotIn("demo@example.invalid", captured.getvalue())
        self.assertNotIn("private-demo", captured.getvalue())
        self.assertNotIn(str(output), captured.getvalue())
        for path in output.iterdir():
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(output.stat().st_mode), 0o700)

    def test_output_and_input_symlink_guards(self):
        with self.assertRaises(analyzer.AnalyzerError):
            analyzer.ensure_output_directory(self.public / "output", [self.public, self.private])
        repo = self.root / "another-repository"
        (repo / ".git").mkdir(parents=True)
        with self.assertRaises(analyzer.AnalyzerError):
            analyzer.ensure_output_directory(repo / "output", [self.public, self.private])
        link = self.root / "linked"
        link.symlink_to(self.private, target_is_directory=True)
        with self.assertRaises(analyzer.AnalyzerError):
            analyzer.ensure_output_directory(link / "output", [self.public, self.private])
        self.write("wiki/example.md")
        (self.public / "wiki/leak.md").symlink_to(self.private / "missing.md")
        with self.assertRaises(analyzer.AnalyzerError):
            self.report()
        external = self.root / "external"
        external.write_text("untouched")
        (self.root / "report.json").symlink_to(external)
        with self.assertRaises(analyzer.AnalyzerError):
            analyzer.secure_write(self.root / "report.json", "changed")
        self.assertEqual(external.read_text(), "untouched")

    def test_career_failure_is_explicit_and_does_not_stop(self):
        self.write("wiki/topics/career-demo-status.md", fields={"updated": "2026-01-01"}, private=True)
        result = analyzer.load_career(Path("/nonexistent/client.ts"), "nonexistent-runtime")
        report = self.report(career=result)
        self.assertEqual(len(report["career_read"]), 4)
        self.assertTrue(all(i["status"] == "확인 못 함" for i in report["career_read"]))
        self.assertEqual(report["items"][0]["memory_comparison"]["status"], "대상 없음")

    def test_career_success_conflicts_and_dates(self):
        self.write("wiki/topics/career-example-status.md", "# Career\n\nSynthetic current career value.", fields={"updated": "2026-01-01"}, private=True)
        career = [{"key": "career-status", "status": "확인함", "document": {
            "body": "Synthetic other career value.", "updatedAt": "2026-02-01T00:00:00Z", "version": 3,
        }}]
        report = self.report(career=career)
        item = report["items"][0]
        self.assertEqual(item["verdict"], "CONFLICT")
        evidence = item["career_comparison"][0]
        self.assertEqual(evidence["source_date"], "2026-02-01")
        self.assertEqual(evidence["left"]["source_date"], "2026-01-01")
        self.assertEqual(evidence["revision"], 3)
        self.assertNotIn("Synthetic other career value", json.dumps(report))

    def test_career_unrelated_document_is_not_conflict(self):
        self.write("wiki/topics/career-example-history.md", "# Synthetic career history\n\nA historical fact.", fields={"updated": "2026-01-01"}, private=True)
        career = [{"key": "career-status", "status": "확인함", "document": {
            "body": "Synthetic current career value.", "updatedAt": "2026-02-01", "version": 1,
        }}]
        item = self.report(career=career)["items"][0]
        self.assertEqual(item["verdict"], "NEW")
        self.assertEqual(item["career_comparison"][0]["status"], "해당 없음")
        self.assertEqual(item["stale_evidence"], [])

    def test_sensitive_comparison_metadata_hidden_from_normal_rows(self):
        self.write("wiki/topics/work-style.md", "# Work style\n\nSynthetic first value.", fields={"updated": "2026-01-01"})
        self.write("wiki/topics/sensitive-hidden-path.md", "# Private working preference\n\nSynthetic second value.", fields={"updated": "2026-09-17", "document_key": "work-style"}, private=True)
        report = self.report()
        rendered = analyzer.render_html(report)
        self.assertNotIn("sensitive-hidden-path", rendered)
        self.assertNotIn("2026-09-17", rendered)
        self.assertIn("Private working preference", rendered)
        self.assertIn("sensitive-hidden-path", json.dumps(report))

    def test_duplicate_requires_same_title_and_body(self):
        self.write("wiki/topics/one.md", "Same synthetic body.", fields={"title": "First title", "document_key": "example", "updated": "2026-01-01"})
        self.write("raw/notes/two.md", "Same synthetic body.", fields={"title": "Second title", "document_key": "example", "collected": "2026-01-01"})
        items = self.report()["items"]
        self.assertTrue(all(item["verdict"] == "NEW" for item in items))
        self.assertTrue(all(item["brain_comparison"][0]["status"] == "RELATED" for item in items))

    def test_stale_after_boundary_and_ordered_infra_rule(self):
        self.write("wiki/topics/health-example-status.md", "# Health example\n\nSynthetic password: placeholder.", fields={"updated": "2026-10-02", "stale_after": "2026-10-02"}, private=True)
        item = self.report()["items"][0]
        self.assertEqual(item["verdict"], "STALE")
        self.assertEqual(item["classification"], "IMPORT_DOCUMENT")
        self.assertEqual(item["rule"], 4)
        self.assertTrue(item["review_flags"])
        self.assertIn("보류", item["hold"])

    def test_adapter_calls_get_only(self):
        client = self.root / "client.mjs"
        client.write_text(
            'export function createCandidateContextClient(){ return { '
            'getDocument: async key => ({documentKey:key, body:"synthetic", updatedAt:"2026-01-01",version:1}), '
            'putDocument: () => { throw Error("MUTATION"); }}; }', encoding="utf-8"
        )
        result = analyzer.load_career(client, "node")
        self.assertEqual([r["key"] for r in result], list(analyzer.CAREER_KEYS))
        self.assertTrue(all(r["status"] == "확인함" for r in result))

    def test_malformed_frontmatter_requires_review(self):
        self.write("wiki/example.md", "---\nsensitivity: NORMAL\nsensitivity: SENSITIVE\n---\n# Example")
        self.write("wiki/unterminated.md", "---\ncollection: core\n# Example")
        report = self.report()
        self.assertTrue(all(i["classification"] == "REVIEW_REQUIRED" for i in report["items"]))
        self.assertTrue(all(i["sensitivity"] == "SENSITIVE" for i in report["items"]))

    def test_ignored_home_data_is_allowed_but_project_output_is_not(self):
        home = self.root / "synthetic-home"
        home.mkdir()
        subprocess.run(["git", "init", "--quiet", str(home)], check=True, capture_output=True)
        (home / ".gitignore").write_text(".local/\n")
        with patch.object(analyzer.Path, "home", return_value=home):
            output = analyzer.ensure_output_directory(home / ".local/data/report", [self.public, self.private])
            self.assertEqual(output, home / ".local/data/report")
            with self.assertRaises(analyzer.AnalyzerError):
                analyzer.ensure_output_directory(home / "tracked-report", [self.public, self.private])

    def test_input_bytes_unchanged_after_full_run(self):
        files = [self.write("wiki/topics/work-style.md", fields={"updated": "2026-01-01"}),
                 self.write("raw/notes/synthetic.md", fields={"collected": "2026-01-01"}, private=True)]
        before = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in files}
        with redirect_stdout(io.StringIO()):
            result = analyzer.main(["--public-root", str(self.public), "--private-root", str(self.private), "--output-dir", str(self.root / "reports")])
        self.assertEqual(result, 0)
        after = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in files}
        self.assertEqual(before, after)

    def test_unreadable_input_error_has_no_private_path(self):
        captured = io.StringIO()
        with redirect_stderr(captured), patch.object(analyzer.Path, "read_text", side_effect=OSError("PRIVATE_VALUE")):
            self.write("wiki/example.md")
            code = analyzer.main(["--public-root", str(self.public), "--private-root", str(self.private), "--output-dir", str(self.root / "reports")])
        self.assertEqual(code, 1)
        self.assertNotIn("PRIVATE_VALUE", captured.getvalue())


if __name__ == "__main__":
    unittest.main()
