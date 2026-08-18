#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PINNED_QMD = path.join(os.homedir(), ".local", "bin-pinned", "qmd");
const DEFAULT_PASS_THRESHOLD = 0.8;
const DEFAULT_TOP_K = 3;

function selectQmd() {
  try {
    fs.accessSync(PINNED_QMD, fs.constants.X_OK);
    return PINNED_QMD;
  } catch {
    throw new Error(`pinned qmd executable not found: ${PINNED_QMD}`);
  }
}

function parseFixture(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (!fixture || !Array.isArray(fixture.fixtures) || fixture.fixtures.length === 0) {
    throw new Error("fixture.fixtures must be a non-empty array");
  }
  const passThreshold = fixture.pass_threshold ?? DEFAULT_PASS_THRESHOLD;
  if (typeof passThreshold !== "number" || passThreshold < 0 || passThreshold > 1) {
    throw new Error("pass_threshold must be a number between 0 and 1");
  }
  for (const [index, entry] of fixture.fixtures.entries()) {
    if (typeof entry.query !== "string" || entry.query.trim() === "") {
      throw new Error(`fixtures[${index}].query must be a non-empty string`);
    }
    if (typeof entry.collection !== "string" || entry.collection.trim() === "") {
      throw new Error(`fixtures[${index}].collection must be a non-empty string`);
    }
    if (!Array.isArray(entry.expected_slugs) || entry.expected_slugs.length === 0 || !entry.expected_slugs.every((slug) => typeof slug === "string" && slug.length > 0)) {
      throw new Error(`fixtures[${index}].expected_slugs must be a non-empty string array`);
    }
    if (entry.top_k !== undefined && (!Number.isInteger(entry.top_k) || entry.top_k < 1)) {
      throw new Error(`fixtures[${index}].top_k must be a positive integer`);
    }
  }
  return { fixture, passThreshold };
}

function parseQmdResults(output) {
  const jsonStart = output.lastIndexOf("\n[");
  const json = output.slice(jsonStart >= 0 ? jsonStart + 1 : 0).trim();
  const results = JSON.parse(json);
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("qmd returned no interpretable results");
  }
  return results;
}

function rankSlugs(results, collection) {
  const prefix = `qmd://${collection}/`;
  const rankedSlugs = [];
  for (const result of results) {
    if (typeof result.file !== "string" || !result.file.startsWith(prefix) || !result.file.endsWith(".md")) {
      continue;
    }
    const slug = result.file.slice(prefix.length, -".md".length).split("/").pop();
    if (slug && !rankedSlugs.includes(slug)) {
      rankedSlugs.push(slug);
    }
  }
  if (rankedSlugs.length === 0) {
    throw new Error("qmd output contained no result URI for the requested collection");
  }
  return rankedSlugs;
}

function benchmarkEntry(qmd, entry) {
  const topK = entry.top_k ?? DEFAULT_TOP_K;
  const output = execFileSync(qmd, ["query", entry.query, "-c", entry.collection, "-n", String(topK), "--format", "json"], {
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  const rankedSlugs = rankSlugs(parseQmdResults(output), entry.collection);
  const ranks = Object.fromEntries(entry.expected_slugs.map((slug) => [slug, rankedSlugs.indexOf(slug) + 1]));
  const matchedSlugs = entry.expected_slugs.filter((slug) => ranks[slug] > 0 && ranks[slug] <= topK);
  return {
    query: entry.query,
    collection: entry.collection,
    expected_slugs: entry.expected_slugs,
    top_k: topK,
    ranked_slugs: rankedSlugs,
    ranks,
    matched_slugs: matchedSlugs,
    success: matchedSlugs.length === entry.expected_slugs.length,
  };
}

function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath || process.argv.length > 3) {
    throw new Error("usage: retrieval-benchmark.cjs <fixture.json>");
  }
  const { fixture, passThreshold } = parseFixture(fixturePath);
  const qmd = selectQmd();
  const results = [];
  for (const entry of fixture.fixtures) {
    try {
      results.push(benchmarkEntry(qmd, entry));
    } catch (error) {
      results.push({
        query: entry.query,
        collection: entry.collection,
        expected_slugs: entry.expected_slugs,
        top_k: entry.top_k ?? DEFAULT_TOP_K,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const passed = results.filter((result) => result.success).length;
  const passRate = passed / results.length;
  const report = {
    fixture: fixturePath,
    qmd_command: qmd,
    pass_threshold: passThreshold,
    passed,
    total: results.length,
    pass_rate: passRate,
    results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (results.some((result) => result.error) || passRate < passThreshold) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
