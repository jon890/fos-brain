#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// scripts/ -> brain/ -> plugin/ -> .agents/ -> <fos-brain root>
const BRAIN_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const PINNED_QMD = path.join(os.homedir(), ".local", "bin-pinned", "qmd");

const EXPECTED_COLLECTIONS = [
  { name: "brain-wiki", relPath: "wiki" },
  { name: "brain-raw", relPath: "raw" },
  { name: "brain-private", relPath: "private/wiki" },
];

function selectQmd() {
  try {
    fs.accessSync(PINNED_QMD, fs.constants.X_OK);
    return PINNED_QMD;
  } catch {
    return null;
  }
}

function existingCollectionNames(qmd) {
  try {
    const out = execFileSync(qmd, ["collection", "list"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    return [...out.matchAll(/^([a-zA-Z0-9_-]+) \(qmd:\/\//gm)].map((m) => m[1]);
  } catch {
    return [];
  }
}

function ensureCollectionsRegistered(qmd, notes) {
  const existing = new Set(existingCollectionNames(qmd));
  for (const { name, relPath } of EXPECTED_COLLECTIONS) {
    if (existing.has(name)) continue;
    const abs = path.join(BRAIN_ROOT, relPath);
    if (!fs.existsSync(abs)) continue; // private 미클론 등, 정상 상황
    try {
      execFileSync(qmd, ["collection", "add", abs, "--name", name], {
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
  const qmd = selectQmd();
  if (qmd) {
    ensureCollectionsRegistered(qmd, notes);
  } else {
    notes.push(`고정 qmd 실행 파일을 찾지 못해 컬렉션 점검을 건너뛴다 (${PINNED_QMD}).`);
  }
  if (notes.length > 0) {
    process.stdout.write(JSON.stringify({ systemMessage: `[brain-sync] ${notes.join(" ")}` }));
  }
}

main();
