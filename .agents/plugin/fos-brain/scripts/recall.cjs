#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");

const COLLECTIONS = ["brain-wiki", "brain-private"];
const MAX_RESULTS = 3;
const MIN_PROMPT_LENGTH = 12;

function readStdin() {
  try {
    const raw = require("node:fs").readFileSync(0, "utf-8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function extractPrompt(input) {
  return (
    input.prompt ||
    input.user_prompt ||
    input.message ||
    input.text ||
    ""
  ).toString();
}

function availableCollections() {
  try {
    const out = execFileSync("qmd", ["collection", "list"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const names = [...out.matchAll(/^([a-zA-Z0-9_-]+) \(qmd:\/\//gm)].map((m) => m[1]);
    return COLLECTIONS.filter((c) => names.includes(c));
  } catch {
    return [];
  }
}

function runQmdQuery(text, collections) {
  const args = ["query", text, "-n", String(MAX_RESULTS), "--json", "--no-rerank"];
  for (const c of collections) {
    args.push("-c", c);
  }
  const out = execFileSync("qmd", args, {
    encoding: "utf-8",
    timeout: 8000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out);
}

function formatContext(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const lines = results.map((r) => {
    const path = r.path || r.file || "unknown";
    const snippet = (r.snippet || r.text || "").toString().slice(0, 400).trim();
    return `- [${path}] ${snippet}`;
  });
  return [
    "다음은 개인 지식 기반(fos-brain)에서 이 대화와 관련성이 높다고 판단된 항목이다. 참고용이며, 관련이 없으면 무시해도 된다.",
    ...lines,
  ].join("\n");
}

function emit(additionalContext) {
  // Claude Code 공식 스키마. Codex(oh-my-codex hooks.json)도 동일 이벤트명·command 계약을 쓰지만
  // additionalContext 소비 여부는 실제 세션에서 별도 확인이 필요하다(코드명 hook 소비부가 비공개 바이너리).
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: additionalContext,
      },
    })
  );
}

function main() {
  const input = readStdin();
  const prompt = extractPrompt(input).trim();
  if (prompt.length < MIN_PROMPT_LENGTH) return;

  const collections = availableCollections();
  if (collections.length === 0) return;

  let parsed;
  try {
    parsed = runQmdQuery(prompt, collections);
  } catch {
    return;
  }

  const results = parsed.results || parsed.matches || parsed;
  const context = formatContext(results);
  if (!context) return;

  emit(context);
}

main();
