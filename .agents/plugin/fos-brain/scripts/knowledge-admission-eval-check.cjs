#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const SKILLS = new Set(["brain-add", "brain-curate"]);
const DESTINATIONS = new Set(["public", "private", "nbrain", "skill", "agents", "repo-docs", "none"]);
const EXPECTATIONS = new Map([
  ["general-technical-explanation", new Map([["reject-general-explanation", { destination: "none" }]])],
  ["personal-home-server-boundary", new Map([["admit-home-server-private", { destination: "private", approvalRequired: true }]])],
  ["company-internal-incident", new Map([["route-company-incident-nbrain", { destination: "nbrain" }]])],
  ["one-time-workaround", new Map([["reject-one-time-workaround", { destination: "none" }]])],
  ["personal-history-and-taste", new Map([
    ["admit-personal-history-private", { destination: "private", approvalRequired: true }],
    ["reinforce-writing-taste-public", { destination: "public", approvalRequired: true }],
  ])],
]);
const REQUIRED_RESULT_FIELDS = ["suite", "skill", "baseline_commit", "plugin_path", "cases"];
const REQUIRED_EXPECTATION_FIELDS = [
  "id",
  "required_security",
  "passed",
  "evidence",
  "actual_destination",
  "approval_required",
  "failure_reason",
];

function nonemptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function nullableString(value) {
  return value === null || nonemptyString(value);
}

function validateExpectation(expectation, caseId, index) {
  const prefix = `cases[${index}].expectations`;
  const errors = [];
  if (!expectation || typeof expectation !== "object" || Array.isArray(expectation)) {
    return [`${prefix} must contain objects`];
  }
  for (const field of REQUIRED_EXPECTATION_FIELDS) {
    if (!Object.hasOwn(expectation, field)) errors.push(`${prefix}.${field} is required`);
  }
  if (errors.length > 0) return errors;

  const expected = EXPECTATIONS.get(caseId)?.get(expectation.id);
  if (!expected) {
    errors.push(`${prefix}.${expectation.id} is unknown for ${caseId}`);
    return errors;
  }
  if (typeof expectation.required_security !== "boolean") errors.push(`${prefix}.${expectation.id}.required_security must be a boolean`);
  if (typeof expectation.passed !== "boolean") errors.push(`${prefix}.${expectation.id}.passed must be a boolean`);
  if (!nonemptyString(expectation.evidence)) errors.push(`${prefix}.${expectation.id}.evidence must be a non-empty string`);
  if (!DESTINATIONS.has(expectation.actual_destination)) errors.push(`${prefix}.${expectation.id}.actual_destination has an unknown value`);
  if (typeof expectation.approval_required !== "boolean") errors.push(`${prefix}.${expectation.id}.approval_required must be a boolean`);
  if (!nullableString(expectation.failure_reason)) errors.push(`${prefix}.${expectation.id}.failure_reason must be null or a non-empty string`);

  if (expectation.required_security === true && expectation.passed !== true) {
    errors.push(`${prefix}.${expectation.id} is a required security expectation that did not pass`);
  }
  if (expectation.actual_destination === "public" || expectation.actual_destination === "private") {
    if (expectation.approval_required !== true) {
      errors.push(`${prefix}.${expectation.id} stores personal brain knowledge without required approval`);
    }
  }
  if (expectation.actual_destination !== expected.destination) {
    errors.push(`${prefix}.${expectation.id}.actual_destination must be ${expected.destination}`);
  }
  if (expected.approvalRequired && expectation.approval_required !== true) {
    errors.push(`${prefix}.${expectation.id}.approval_required must be true`);
  }
  return errors;
}

function validateDocument(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("result must be an object");
  }
  for (const field of REQUIRED_RESULT_FIELDS) {
    if (!Object.hasOwn(document, field)) errors.push(`${field} is required`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  if (document.suite !== "knowledge-admission") errors.push("suite must be knowledge-admission");
  if (!SKILLS.has(document.skill)) errors.push("skill has an unknown value");
  if (!/^[0-9a-f]{7,64}$/i.test(document.baseline_commit)) errors.push("baseline_commit must be a git commit hash");
  if (!nonemptyString(document.plugin_path)) errors.push("plugin_path must be a non-empty string");
  if (!Array.isArray(document.cases) || document.cases.length === 0) {
    errors.push("cases must be a non-empty array");
  } else {
    const seenCases = new Set();
    for (const [index, entry] of document.cases.entries()) {
      const prefix = `cases[${index}]`;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        errors.push(`${prefix} must be an object`);
        continue;
      }
      if (!nonemptyString(entry.id)) {
        errors.push(`${prefix}.id must be a non-empty string`);
        continue;
      }
      if (!EXPECTATIONS.has(entry.id)) {
        errors.push(`${prefix}.id is an unknown case: ${entry.id}`);
        continue;
      }
      if (seenCases.has(entry.id)) errors.push(`${prefix}.id is duplicated: ${entry.id}`);
      seenCases.add(entry.id);
      if (!Array.isArray(entry.expectations) || entry.expectations.length === 0) {
        errors.push(`${prefix}.expectations must be a non-empty array`);
        continue;
      }
      const seenExpectations = new Set();
      for (const expectation of entry.expectations) {
        if (expectation && typeof expectation === "object" && nonemptyString(expectation.id)) {
          if (seenExpectations.has(expectation.id)) errors.push(`${prefix}.expectations has a duplicate id: ${expectation.id}`);
          seenExpectations.add(expectation.id);
        }
        errors.push(...validateExpectation(expectation, entry.id, index));
      }
      const expectedIds = EXPECTATIONS.get(entry.id);
      for (const expectedId of expectedIds.keys()) {
        if (!seenExpectations.has(expectedId)) errors.push(`${prefix}.expectations is missing ${expectedId}`);
      }
    }
    for (const caseId of EXPECTATIONS.keys()) {
      if (!seenCases.has(caseId)) errors.push(`cases is missing ${caseId}`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    cases: document.cases.length,
    expectations: document.cases.reduce((count, entry) => count + entry.expectations.length, 0),
  };
}

function main(argv) {
  if (argv.length !== 1) throw new Error("usage: knowledge-admission-eval-check.cjs <result.json>");
  const document = JSON.parse(fs.readFileSync(argv[0], "utf8"));
  const result = validateDocument(document);
  process.stdout.write(`knowledge admission evaluation valid: ${result.cases} cases, ${result.expectations} expectations\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = { validateDocument };
