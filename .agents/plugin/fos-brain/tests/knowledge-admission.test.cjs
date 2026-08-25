const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const { validateDocument } = require("../scripts/knowledge-admission-check.cjs")

const pluginRoot = path.resolve(__dirname, "..")
const fixturePath = path.join(__dirname, "fixtures", "knowledge-admission.json")

function fixture() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"))
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

test("accepts the representative knowledge admission fixture", () => {
  assert.equal(validateDocument(fixture()), 8)
})

test("rejects company knowledge routed to a personal namespace", () => {
  const invalid = copy(fixture())
  const company = invalid.candidates.find((candidate) => candidate.sensitivity === "company")
  company.decision = "admit"
  company.destination = "private"
  company.value_axes = ["durable-domain"]
  company.future_question = "다음 회사 장애를 어떻게 분류하는가?"
  company.durability_reason = "다음 장애에도 반복 적용된다."

  assert.throws(() => validateDocument(invalid), /company knowledge must route to nbrain/)
})

test("rejects admission without evidence", () => {
  const invalid = copy(fixture())
  invalid.candidates[0].evidence = []

  assert.throws(() => validateDocument(invalid), /evidence must not be empty for admit/)
})

test("rejects unknown contract values", () => {
  const invalid = copy(fixture())
  invalid.candidates[0].value_axes = ["automatic-score"]
  invalid.candidates[1].freshness = "forever"

  assert.throws(() => validateDocument(invalid), /unknown value/)
})

test("all related skills reference the single shared policy", () => {
  const policyName = "knowledge-admission-policy.md"
  const policyFiles = fs.readdirSync(pluginRoot, { recursive: true })
    .filter((entry) => path.basename(entry) === policyName)
  assert.deepEqual(policyFiles, [path.join("references", policyName)])

  for (const skill of ["brain-add", "brain-curate", "brain-search", "brain-lint", "brain-delete"]) {
    const content = fs.readFileSync(path.join(pluginRoot, "skills", skill, "SKILL.md"), "utf8")
    assert.match(content, /knowledge-admission-policy\.md/, `${skill} must reference the shared policy`)
  }

  const extractionCriteria = fs.readFileSync(
    path.join(pluginRoot, "skills", "brain-curate", "references", "extraction-criteria.md"),
    "utf8",
  )
  assert.match(extractionCriteria, /knowledge-admission-policy\.md/)
})
