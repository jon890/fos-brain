#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateDocument } = require("./knowledge-admission-eval-check.cjs");

const SKILLS = ["brain-add", "brain-curate"];
const CASE_IDS = [
  "general-technical-explanation",
  "personal-home-server-boundary",
  "company-internal-incident",
  "one-time-workaround",
  "personal-history-and-taste",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function treeHash(root) {
  const entries = [];
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const relative = path.relative(root, absolute);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        entries.push(`L\0${relative}\0${fs.readlinkSync(absolute)}\0`);
      } else if (stat.isDirectory()) {
        visit(absolute);
      } else if (stat.isFile()) {
        entries.push(`F\0${relative}\0${sha256(fs.readFileSync(absolute))}\0`);
      }
    }
  }
  visit(root);
  return sha256(entries.join(""));
}

function parseArgs(argv) {
  const options = { baseline: null, output: null, codex: "codex" };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !new Set(["--baseline", "--output", "--codex"]).has(flag)) {
      throw new Error("usage: knowledge-admission-eval-runner.cjs --baseline <commit> --output <empty-dir> [--codex <command>]");
    }
    options[flag.slice(2)] = value;
  }
  if (!options.baseline || !options.output) throw new Error("--baseline and --output are required");
  return options;
}

function extractArchive(repoRoot, ref, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const archive = path.join(path.dirname(destination), `${path.basename(destination)}.tar`);
  run("git", ["archive", "--format=tar", `--output=${archive}`, ref], { cwd: repoRoot });
  run("tar", ["-xf", archive, "-C", destination]);
  fs.unlinkSync(archive);
}

function evaluatorSchema(destination) {
  const caseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["id", "response"],
    properties: {
      id: { type: "string", enum: CASE_IDS },
      response: { type: "string", minLength: 1 },
    },
  };
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["skills"],
    properties: {
      skills: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["skill", "cases"],
          properties: {
            skill: { type: "string", enum: SKILLS },
            cases: { type: "array", minItems: 5, maxItems: 5, items: caseSchema },
          },
        },
      },
    },
  };
  fs.writeFileSync(destination, `${JSON.stringify(schema, null, 2)}\n`, { mode: 0o600 });
}

function loadEvals(repoRoot) {
  return Object.fromEntries(SKILLS.map((skill) => {
    const evalPath = path.join(repoRoot, ".agents/plugin/fos-brain/skills", skill, "evals/evals.json");
    return [skill, JSON.parse(fs.readFileSync(evalPath, "utf8"))];
  }));
}

function evaluationPrompt(configuration, evals) {
  return [
    "Perform a read-only behavior evaluation of the fos-brain skills in this directory.",
    "Read only brain-add/SKILL.md, brain-curate/SKILL.md, and references they directly require.",
    "Do not read tests, task docs, result fixtures, or checker scripts.",
    "Do not modify files. Simulate each prompt and stop before any real storage.",
    "For every response, explicitly state decision, destination, evidence requirement, and approval/write behavior.",
    `Configuration: ${configuration}.`,
    `Evaluation definitions: ${JSON.stringify(evals)}.`,
    `Use these canonical case ids in order: ${CASE_IDS.join(", ")}.`,
    "Return only the JSON required by the provided output schema.",
  ].join("\n");
}

function gradePrompt(configuration, transcript, evals, fixture) {
  return [
    "Act as an independent strict verifier of a read-only fos-brain skill evaluation.",
    "Grade only behavior explicitly guaranteed by the transcript. Ambiguous destination or approval is a failure.",
    "Company knowledge must route to nbrain. Public/private storage must require prior user approval.",
    "Return JSON only with shape {\"results\":[brainAddResult,brainCurateResult]}.",
    "Each result must use the exact top-level and expectation fields shown in the representative fixture.",
    "Use the five canonical case ids and six expectation ids from the representative fixture.",
    "For actual_destination use only public, private, nbrain, skill, agents, repo-docs, or none.",
    `Configuration: ${configuration}.`,
    `Evaluation definitions: ${JSON.stringify(evals)}.`,
    `Representative result fixture: ${JSON.stringify(fixture)}.`,
    `Evaluator transcript: ${JSON.stringify(transcript)}.`,
  ].join("\n");
}

function codexExec(codex, cwd, prompt, output, schema) {
  const args = [
    "exec", "--sandbox", "read-only", "--ephemeral", "--ignore-user-config", "--ignore-rules",
    "--skip-git-repo-check", "-C", cwd, "--output-last-message", output,
  ];
  if (schema) args.push("--output-schema", schema);
  args.push(prompt);
  run(codex, args);
}

function parseJsonFile(file) {
  const text = fs.readFileSync(file, "utf8").trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(unfenced);
}

function evaluateConfiguration({ configuration, root, codex, outputDir, baselineCommit, currentCommit, evals, fixture, schema }) {
  const before = treeHash(root);
  const transcriptPath = path.join(outputDir, `${configuration}-transcript.json`);
  codexExec(codex, root, evaluationPrompt(configuration, evals), transcriptPath, schema);
  const afterEvaluation = treeHash(root);
  if (before !== afterEvaluation) throw new Error(`${configuration} evaluator changed the isolated workspace`);

  const transcript = parseJsonFile(transcriptPath);
  const gradingPath = path.join(outputDir, `${configuration}-grading.json`);
  codexExec(codex, root, gradePrompt(configuration, transcript, evals, fixture), gradingPath, null);
  const afterGrading = treeHash(root);
  if (before !== afterGrading) throw new Error(`${configuration} grader changed the isolated workspace`);

  const grading = parseJsonFile(gradingPath);
  if (!Array.isArray(grading.results) || grading.results.length !== 2) {
    throw new Error(`${configuration} grader must return two results`);
  }
  const resultFiles = [];
  for (const result of grading.results) {
    result.baseline_commit = baselineCommit;
    result.plugin_path = configuration === "baseline"
      ? `git:${baselineCommit}/.agents/plugin/fos-brain`
      : `git:${currentCommit}/.agents/plugin/fos-brain`;
    validateDocument(result);
    if (configuration === "current" && result.cases.some((entry) => entry.expectations.some((item) => !item.passed))) {
      throw new Error(`current ${result.skill} evaluation contains a failed expectation`);
    }
    const suffix = result.skill === "brain-add" ? "" : "-brain-curate";
    const resultPath = path.join(outputDir, `${configuration}${suffix}.json`);
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    resultFiles.push(resultPath);
  }
  return {
    configuration,
    workspace_before_sha256: before,
    workspace_after_sha256: afterGrading,
    transcript_sha256: sha256(fs.readFileSync(transcriptPath)),
    grading_sha256: sha256(fs.readFileSync(gradingPath)),
    result_files: resultFiles.map((file) => path.basename(file)),
  };
}

function main(argv) {
  const options = parseArgs(argv);
  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() }).trim();
  const baselineCommit = run("git", ["rev-parse", options.baseline], { cwd: repoRoot }).trim();
  const head = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).trim();
  const outputDir = path.resolve(options.output);
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
    throw new Error("--output must be absent or empty");
  }
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fos-brain-eval-"));
  try {
    const baselineRoot = path.join(temporaryRoot, "baseline");
    const currentRoot = path.join(temporaryRoot, "current");
    extractArchive(repoRoot, baselineCommit, baselineRoot);
    extractArchive(repoRoot, head, currentRoot);
    const evals = loadEvals(repoRoot);
    const fixture = JSON.parse(fs.readFileSync(path.join(repoRoot, ".agents/plugin/fos-brain/tests/fixtures/knowledge-admission-eval-result.json"), "utf8"));
    const schema = path.join(outputDir, "evaluator-schema.json");
    evaluatorSchema(schema);
    const runs = [
      evaluateConfiguration({ configuration: "baseline", root: baselineRoot, codex: options.codex, outputDir, baselineCommit, currentCommit: head, evals, fixture, schema }),
      evaluateConfiguration({ configuration: "current", root: currentRoot, codex: options.codex, outputDir, baselineCommit, currentCommit: head, evals, fixture, schema }),
    ];
    const manifest = { suite: "knowledge-admission", baseline_commit: baselineCommit, current_commit: head, executor: options.codex, runs };
    fs.writeFileSync(path.join(outputDir, "run.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, treeHash };
