#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const QUEUE_PATH = path.join(__dirname, "..", "staging", "pending-sessions.jsonl");

function readStdin() {
  try {
    const raw = fs.readFileSync(0, "utf-8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function detectTool() {
  if (process.env.CLAUDE_PLUGIN_ROOT) return "claude";
  if (process.env.PLUGIN_ROOT) return "codex";
  return "unknown";
}

function main() {
  const input = readStdin();
  const sessionId = input.session_id || input.sessionId || input.id || null;
  const transcriptPath =
    input.transcript_path || input.transcriptPath || input.transcript || input.log_path || null;
  const cwd = input.cwd || null;

  if (!sessionId && !transcriptPath) return; // 기록할 게 없으면 조용히 종료

  const entry = {
    tool: detectTool(),
    session_id: sessionId,
    transcript_path: transcriptPath,
    cwd,
    recorded_at: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
  fs.appendFileSync(QUEUE_PATH, JSON.stringify(entry) + "\n");
}

main();
