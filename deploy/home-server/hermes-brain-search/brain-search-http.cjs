#!/usr/bin/env node
"use strict";

const DEFAULT_TIMEOUT_MS = 8000;
const ALLOWED_COLLECTIONS = new Set(["brain-wiki", "brain-raw", "brain-private"]);

function usage() {
  return [
    "Usage: brain-search-http.cjs <question> <collections-json> [limit]",
    "Example: brain-search-http.cjs \"agent workflow\" '[\"brain-wiki\",\"brain-private\"]' 5",
  ].join("\n");
}

function parseLimit(value) {
  const limit = Number.parseInt(value || "5", 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("limit must be an integer between 1 and 20");
  }
  return limit;
}

function parseCollections(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("collections must be a JSON array");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("collections must be a nonempty JSON array");
  }
  for (const collection of parsed) {
    if (typeof collection !== "string" || !ALLOWED_COLLECTIONS.has(collection)) {
      throw new Error(`collection is not allowed: ${collection}`);
    }
  }
  return [...new Set(parsed)];
}

function normalizeBaseUrl(value) {
  if (!value) {
    throw new Error("BRAIN_QMD_URL is required");
  }
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("BRAIN_QMD_URL must use http or https");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function readCollectionFromUri(uri) {
  if (typeof uri !== "string") return null;
  const match = uri.match(/^qmd:\/\/([^/]+)\//);
  return match ? match[1] : null;
}

function collectResultUris(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) collectResultUris(item, output);
    return output;
  }
  for (const key of ["uri", "url", "file", "id", "resource"]) {
    if (typeof value[key] === "string" && value[key].startsWith("qmd://")) {
      output.push(value[key]);
    }
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") collectResultUris(nested, output);
  }
  return output;
}

async function queryHttp({ baseUrl, question, collections, limit, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch }) {
  if (typeof question !== "string" || question.trim() === "") {
    throw new Error("question is required");
  }
  const normalizedCollections = Array.isArray(collections) ? collections : parseCollections(collections);
  const normalizedLimit = typeof limit === "number" ? limit : parseLimit(String(limit || "5"));
  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 20) {
    throw new Error("limit must be an integer between 1 and 20");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        searches: [
          { type: "lex", query: question },
          { type: "vec", query: question },
        ],
        collections: normalizedCollections,
        limit: normalizedLimit,
        rerank: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error("brain-qmd request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`brain-qmd returned HTTP ${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("brain-qmd returned invalid JSON");
  }

  const allowed = new Set(normalizedCollections);
  for (const uri of collectResultUris(payload)) {
    const collection = readCollectionFromUri(uri);
    if (collection && !allowed.has(collection)) {
      throw new Error(`brain-qmd returned a result from disallowed collection: ${collection}`);
    }
  }

  return payload;
}

async function run(argv = process.argv.slice(2), env = process.env, io = process) {
  const [question, collectionsJson, limitArg] = argv;
  if (!question || !collectionsJson) {
    throw new Error(usage());
  }
  const result = await queryHttp({
    baseUrl: env.BRAIN_QMD_URL,
    question,
    collections: parseCollections(collectionsJson),
    limit: parseLimit(limitArg),
  });
  io.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  collectResultUris,
  parseCollections,
  parseLimit,
  queryHttp,
  run,
};
