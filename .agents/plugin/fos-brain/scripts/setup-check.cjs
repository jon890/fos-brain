#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// scripts/ -> brain/ -> plugin/ -> .agents/ -> <fos-brain root>
const BRAIN_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const EXPECTED_COLLECTIONS = [
  { name: "brain-wiki", relPath: "wiki" },
  { name: "brain-raw", relPath: "raw" },
  { name: "brain-private", relPath: "private/wiki" },
];

function hasCommand(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ensureQmdInstalled(notes) {
  if (hasCommand("qmd")) return true;
  if (hasCommand("bun")) {
    try {
      execFileSync("bun", ["install", "-g", "@tobilu/qmd"], {
        stdio: "ignore",
        timeout: 60000,
      });
      notes.push("qmd 가 없어 bun 으로 설치했다.");
      return hasCommand("qmd");
    } catch {
      // fall through to npm attempt
    }
  }
  if (hasCommand("npm")) {
    try {
      execFileSync("npm", ["install", "-g", "@tobilu/qmd"], {
        stdio: "ignore",
        timeout: 60000,
      });
      notes.push("qmd 가 없어 npm 으로 설치했다.");
      return hasCommand("qmd");
    } catch {
      // give up silently, report below
    }
  }
  notes.push("qmd 를 찾지 못했고 자동 설치도 실패했다. `bun install -g @tobilu/qmd` 를 수동 실행해야 recall 기능이 동작한다.");
  return false;
}

// mise 가 세션마다 node 버전을 바꿔 better-sqlite3 ABI 가 어긋나는 문제 회피(fos-brain CLAUDE.md 런타임 함정 참고)
function pinQmdRuntimeToBun() {
  const lockPath = path.join(
    os.homedir(),
    ".bun/install/global/node_modules/@tobilu/qmd/bun.lock"
  );
  if (fs.existsSync(path.dirname(lockPath))) {
    try {
      fs.closeSync(fs.openSync(lockPath, "a"));
    } catch {
      // best-effort
    }
  }
}

function existingCollectionNames() {
  try {
    const out = execFileSync("qmd", ["collection", "list"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    return [...out.matchAll(/^([a-zA-Z0-9_-]+) \(qmd:\/\//gm)].map((m) => m[1]);
  } catch {
    return [];
  }
}

function ensureCollectionsRegistered(notes) {
  const existing = new Set(existingCollectionNames());
  for (const { name, relPath } of EXPECTED_COLLECTIONS) {
    if (existing.has(name)) continue;
    const abs = path.join(BRAIN_ROOT, relPath);
    if (!fs.existsSync(abs)) continue; // private 미클론 등, 정상 상황
    try {
      execFileSync("qmd", ["collection", "add", abs, "--name", name], {
        stdio: "ignore",
        timeout: 15000,
      });
      notes.push(`컬렉션 '${name}' 을 ${abs} 로 등록했다.`);
    } catch {
      notes.push(`컬렉션 '${name}' 등록을 시도했지만 실패했다 (${abs}).`);
    }
  }
}

function main() {
  const notes = [];
  const qmdOk = ensureQmdInstalled(notes);
  if (qmdOk) {
    pinQmdRuntimeToBun();
    ensureCollectionsRegistered(notes);
  }
  if (notes.length > 0) {
    process.stdout.write(JSON.stringify({ systemMessage: `[brain-sync] ${notes.join(" ")}` }));
  }
}

main();
