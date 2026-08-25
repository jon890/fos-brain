#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const DECISIONS = new Set(["admit", "reinforce", "route", "reject"]);
const VALUE_AXES = new Set([
  "work-style",
  "taste",
  "decision",
  "personal-system",
  "career",
  "durable-domain",
]);
const DESTINATIONS = new Set([
  "public",
  "private",
  "nbrain",
  "skill",
  "agents",
  "repo-docs",
  "none",
]);
const SENSITIVITIES = new Set(["public", "private", "company"]);
const FRESHNESS = new Set(["stable", "review-date-required", "historical"]);
const REQUIRED_FIELDS = [
  "candidate",
  "decision",
  "value_axes",
  "future_question",
  "durability_reason",
  "destination",
  "source_of_truth",
  "sensitivity",
  "freshness",
  "evidence",
  "reason",
];

function nonemptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function nullableNonemptyString(value) {
  return value === null || nonemptyString(value);
}

function candidatesFrom(document) {
  if (Array.isArray(document)) return document;
  if (document && typeof document === "object" && Array.isArray(document.candidates)) {
    return document.candidates;
  }
  throw new Error("input must be an array or an object with a candidates array");
}

function validateCandidate(candidate, index) {
  const prefix = `candidates[${index}]`;
  const errors = [];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return [`${prefix} must be an object`];
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(candidate, field)) errors.push(`${prefix}.${field} is required`);
  }
  if (errors.length > 0) return errors;

  if (!nonemptyString(candidate.candidate)) errors.push(`${prefix}.candidate must be a non-empty string`);
  if (!DECISIONS.has(candidate.decision)) errors.push(`${prefix}.decision has an unknown value`);
  if (!Array.isArray(candidate.value_axes)) {
    errors.push(`${prefix}.value_axes must be an array`);
  } else if (!candidate.value_axes.every((axis) => VALUE_AXES.has(axis))) {
    errors.push(`${prefix}.value_axes contains an unknown value`);
  }
  if (!nullableNonemptyString(candidate.future_question)) {
    errors.push(`${prefix}.future_question must be null or a non-empty string`);
  }
  if (!nullableNonemptyString(candidate.durability_reason)) {
    errors.push(`${prefix}.durability_reason must be null or a non-empty string`);
  }
  if (!DESTINATIONS.has(candidate.destination)) errors.push(`${prefix}.destination has an unknown value`);
  if (!nonemptyString(candidate.source_of_truth)) {
    errors.push(`${prefix}.source_of_truth must be a non-empty string`);
  }
  if (!SENSITIVITIES.has(candidate.sensitivity)) errors.push(`${prefix}.sensitivity has an unknown value`);
  if (!FRESHNESS.has(candidate.freshness)) errors.push(`${prefix}.freshness has an unknown value`);
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0 || !candidate.evidence.every(nonemptyString)) {
    errors.push(`${prefix}.evidence must be a non-empty string array`);
  }
  if (!nonemptyString(candidate.reason)) errors.push(`${prefix}.reason must be a non-empty string`);

  if (candidate.decision === "admit" || candidate.decision === "reinforce") {
    if (!Array.isArray(candidate.value_axes) || candidate.value_axes.length === 0) {
      errors.push(`${prefix}.value_axes must not be empty for ${candidate.decision}`);
    }
    if (!nonemptyString(candidate.future_question)) {
      errors.push(`${prefix}.future_question is required for ${candidate.decision}`);
    }
    if (!nonemptyString(candidate.durability_reason)) {
      errors.push(`${prefix}.durability_reason is required for ${candidate.decision}`);
    }
    if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
      errors.push(`${prefix}.evidence must not be empty for ${candidate.decision}`);
    }
    if (!new Set(["public", "private"]).has(candidate.destination)) {
      errors.push(`${prefix}.destination must be public or private for ${candidate.decision}`);
    }
    if (candidate.destination !== candidate.sensitivity) {
      errors.push(`${prefix}.destination must match sensitivity for ${candidate.decision}`);
    }
  }

  if (candidate.decision === "route" && !new Set(["nbrain", "skill", "agents", "repo-docs"]).has(candidate.destination)) {
    errors.push(`${prefix}.destination is not routable`);
  }
  if (candidate.decision === "reject" && candidate.destination !== "none") {
    errors.push(`${prefix}.destination must be none for reject`);
  }
  if (candidate.sensitivity === "company" && (candidate.decision !== "route" || candidate.destination !== "nbrain")) {
    errors.push(`${prefix} company knowledge must route to nbrain`);
  }
  if (candidate.destination === "nbrain" && candidate.sensitivity !== "company") {
    errors.push(`${prefix} nbrain destination requires company sensitivity`);
  }

  return errors;
}

function validateDocument(document) {
  const candidates = candidatesFrom(document);
  if (candidates.length === 0) throw new Error("candidates must not be empty");
  const errors = candidates.flatMap(validateCandidate);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return candidates.length;
}

function main(argv) {
  if (argv.length !== 1) throw new Error("usage: knowledge-admission-check.cjs <fixture.json>");
  const document = JSON.parse(fs.readFileSync(argv[0], "utf8"));
  const count = validateDocument(document);
  process.stdout.write(`knowledge admission valid: ${count} candidates\n`);
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
