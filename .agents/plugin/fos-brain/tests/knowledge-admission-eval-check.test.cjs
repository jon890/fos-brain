const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const test = require("node:test");

const { validateDocument } = require("../scripts/knowledge-admission-eval-check.cjs");
const { parseArgs, treeHash } = require("../scripts/knowledge-admission-eval-runner.cjs");

const fixturePath = path.join(__dirname, "fixtures", "knowledge-admission-eval-result.json");
const runFixtureRoot = path.join(__dirname, "fixtures", "knowledge-admission-eval-run");
const pluginRoot = path.join(__dirname, "..");

function fixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function fileSha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function expectation(document, caseId, expectationId) {
  return document.cases
    .find((entry) => entry.id === caseId)
    .expectations.find((entry) => entry.id === expectationId);
}

function assertSkillCreatorEval(skill) {
  const evalPath = path.join(pluginRoot, "skills", skill, "evals", "evals.json");
  const document = JSON.parse(fs.readFileSync(evalPath, "utf8"));

  assert.equal(document.skill_name, skill);
  assert.equal(document.evals.length, 5);
  assert.deepEqual(document.evals.map((entry) => entry.id), [1, 2, 3, 4, 5]);
  for (const entry of document.evals) {
    assert.equal(typeof entry.prompt, "string");
    assert.notEqual(entry.prompt.trim(), "");
    assert.equal(typeof entry.expected_output, "string");
    assert.notEqual(entry.expected_output.trim(), "");
    assert.deepEqual(entry.files, []);
    assert.ok(Array.isArray(entry.expectations));
    assert.ok(entry.expectations.length > 0);
    assert.ok(entry.expectations.every((value) => typeof value === "string" && value.trim() !== ""));
  }
}

test("keeps both evaluation definitions in the skill-creator schema", () => {
  assertSkillCreatorEval("brain-add");
  assertSkillCreatorEval("brain-curate");
});

test("keeps plugin and marketplace versions aligned", () => {
  const codexManifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));
  const claudeManifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".claude-plugin", "plugin.json"), "utf8"));
  const marketplace = JSON.parse(fs.readFileSync(path.join(pluginRoot, ".claude-plugin", "marketplace.json"), "utf8"));

  assert.equal(codexManifest.version, "0.2.0");
  assert.equal(claudeManifest.version, codexManifest.version);
  assert.equal(marketplace.version, codexManifest.version);
  assert.equal(marketplace.plugins[0].version, codexManifest.version);
});

test("the reusable runner rejects incomplete arguments", () => {
  assert.throws(() => parseArgs(["--baseline", "main"]), /--baseline and --output are required/);
  assert.deepEqual(parseArgs(["--baseline", "main", "--output", "/tmp/result"]), {
    baseline: "main",
    output: "/tmp/result",
    codex: "codex",
  });
});

test("the reusable runner detects isolated workspace writes", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-admission-runner-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, "nested"));
  fs.writeFileSync(path.join(directory, "nested", "note.md"), "before\n");

  const before = treeHash(directory);
  assert.equal(treeHash(directory), before);
  fs.writeFileSync(path.join(directory, "nested", "note.md"), "after\n");
  assert.notEqual(treeHash(directory), before);
});

test("the persisted behavior run has intact provenance and passing current results", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(runFixtureRoot, "run.json"), "utf8"));

  assert.equal(manifest.runs.length, 2);
  for (const run of manifest.runs) {
    assert.equal(run.workspace_before_sha256, run.workspace_after_sha256);
    assert.equal(fileSha256(path.join(runFixtureRoot, `${run.configuration}-transcript.json`)), run.transcript_sha256);
    assert.equal(fileSha256(path.join(runFixtureRoot, `${run.configuration}-grading.json`)), run.grading_sha256);
    for (const resultFile of run.result_files) {
      const result = JSON.parse(fs.readFileSync(path.join(runFixtureRoot, resultFile), "utf8"));
      validateDocument(result);
      if (run.configuration === "current") {
        assert.ok(result.cases.every((entry) => entry.expectations.every((item) => item.passed)));
        assert.equal(result.plugin_path, `git:${manifest.current_commit}/.agents/plugin/fos-brain`);
      }
    }
  }
});

test("accepts a representative knowledge admission evaluation result", () => {
  assert.deepEqual(validateDocument(fixture()), { cases: 5, expectations: 6 });
});

test("rejects an unknown evaluation case", () => {
  const invalid = copy(fixture());
  invalid.cases.push({ id: "unreviewed-case", expectations: [] });

  assert.throws(() => validateDocument(invalid), /unknown case/);
});

test("rejects an expectation without evaluator evidence", () => {
  const invalid = copy(fixture());
  expectation(invalid, "general-technical-explanation", "reject-general-explanation").evidence = "";

  assert.throws(() => validateDocument(invalid), /evidence must be a non-empty string/);
});

test("rejects company knowledge directed to a personal brain namespace", () => {
  const invalid = copy(fixture());
  const company = expectation(invalid, "company-internal-incident", "route-company-incident-nbrain");
  company.actual_destination = "private";
  company.approval_required = true;

  assert.throws(() => validateDocument(invalid), /actual_destination must be nbrain/);
});

test("rejects personal brain storage without an approval requirement", () => {
  const invalid = copy(fixture());
  expectation(invalid, "personal-home-server-boundary", "admit-home-server-private").approval_required = false;

  assert.throws(() => validateDocument(invalid), /without required approval/);
});

test("rejects a failed required security expectation", () => {
  const invalid = copy(fixture());
  expectation(invalid, "company-internal-incident", "route-company-incident-nbrain").passed = false;
  expectation(invalid, "company-internal-incident", "route-company-incident-nbrain").failure_reason = "개인 brain 저장을 막지 못했다.";

  assert.throws(() => validateDocument(invalid), /required security expectation/);
});
