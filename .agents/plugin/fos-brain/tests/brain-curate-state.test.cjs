const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const script = path.join(__dirname, "..", "skills", "brain-curate", "scripts", "curate_state.py");

function run(directory, ...args) {
  const result = spawnSync("python3", [script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: path.join(directory, "home"),
      XDG_STATE_HOME: path.join(directory, "state"),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("reads an empty tool-independent curate state", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brain-curate-state-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  const result = run(directory, "show");

  assert.equal(result.source, "empty");
  assert.deepEqual(result.state, {});
  assert.equal(result.path, path.join(directory, "state", "fos-brain", "brain-curate.json"));
});

test("migrates the legacy Claude state when advancing", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "brain-curate-state-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const legacy = path.join(directory, "home", ".claude", "brain-curate.state.json");
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, JSON.stringify({ last_curated: 12, runs: [{ sessions: 1, registered: 1 }] }));

  const before = run(directory, "show");
  assert.equal(before.source, "legacy");

  const advanced = run(
    directory,
    "advance",
    "--started-at",
    "42.5",
    "--sessions",
    "3",
    "--registered",
    "2",
  );
  assert.equal(advanced.migrated_from, "legacy");
  assert.equal(advanced.state.last_curated, 42.5);
  assert.equal(advanced.state.runs.length, 2);

  const after = run(directory, "show");
  assert.equal(after.source, "current");
  assert.equal(after.state.runs.at(-1).sessions, 3);
  assert.equal(after.state.runs.at(-1).registered, 2);
});
