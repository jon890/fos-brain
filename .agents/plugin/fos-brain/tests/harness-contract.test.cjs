const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const pluginRoot = path.join(__dirname, "..");
const brainRoot = process.env.FOS_BRAIN_ROOT || path.join(os.homedir(), "personal", "fos-brain");

test("ships skills without unused session hooks", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));

  assert.equal(manifest.skills, "./skills/");
  assert.equal(Object.hasOwn(manifest, "hooks"), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, "hooks", "hooks.json")), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, "scripts", "setup-check.cjs")), false);
  assert.equal(fs.existsSync(path.join(pluginRoot, "scripts", "track-session.cjs")), false);
});

test("skill instructions do not depend on removed tool-specific surfaces", () => {
  const skillRoot = path.join(pluginRoot, "skills");
  const documents = fs
    .readdirSync(skillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillRoot, entry.name, "SKILL.md"))
    .filter((file) => fs.existsSync(file))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  assert.doesNotMatch(documents, /~\/.claude\/skills\/brain-add/);
  assert.doesNotMatch(documents, /pending-sessions/);
  assert.doesNotMatch(documents, /cmux browser/);
  assert.doesNotMatch(documents, /`AskUserQuestion`/);
});

test("brain score runs outside the repository when the root is explicit", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brain-score-cwd-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const script = path.join(brainRoot, "scripts", "brain_score.py");

  const result = spawnSync("python3", [script, "--root", brainRoot, "--json"], {
    cwd: directory,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.score, 0);
  assert.equal(Object.hasOwn(report.counts, "visibility_leak"), true);
});
