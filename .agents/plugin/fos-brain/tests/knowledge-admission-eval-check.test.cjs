const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { validateDocument } = require("../scripts/knowledge-admission-eval-check.cjs");

const fixturePath = path.join(__dirname, "fixtures", "knowledge-admission-eval-result.json");
const pluginRoot = path.join(__dirname, "..");

function fixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
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
