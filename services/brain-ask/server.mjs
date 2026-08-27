import http from "node:http";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import {
  extractOutputText,
  normalizeQmdResults,
  selectEvidence,
  validateQuestion,
} from "./brainAsk.mjs";

const require = createRequire(import.meta.url);
let queryQmd;
try {
  ({ queryQmd } = require("./brain-search-http.cjs"));
} catch {
  ({ queryQmd } = require("../../.agents/plugin/fos-brain/scripts/brain-search-http.cjs"));
}

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const QMD_TIMEOUT_MS = Number.parseInt(process.env.BRAIN_QMD_TIMEOUT_MS || "10000", 10);
const MODEL_TIMEOUT_MS = Number.parseInt(process.env.MODEL_TIMEOUT_MS || "90000", 10);
const MAX_BODY_BYTES = 4096;

let inFlight = false;

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function requestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function logSafe(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function errorDetails(code) {
  const messages = {
    invalid_question: "Question must be a JSON string from 1 to 500 characters.",
    busy: "Another question is already being processed.",
    retrieval_unavailable: "Evidence retrieval is unavailable.",
    model_unavailable: "Model API is unavailable.",
    model_timeout: "Model API timed out.",
  };
  return {
    code,
    message: messages[code] || "Request failed.",
    retryable: code !== "invalid_question",
  };
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error("invalid_question"), { code: "invalid_question" });
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("invalid_question"), { code: "invalid_question" });
  }
}

async function readLimitedFile(file, { encoding, maxBytes }) {
  const handle = await fs.open(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString(encoding);
  } finally {
    await handle.close();
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function callModel({ question, context, signal }) {
  const apiKey = (await fs.readFile(requiredEnv("MODEL_API_KEY_FILE"), "utf8")).trim();
  const body = {
    model: process.env.MODEL_NAME || "brain",
    store: false,
    instructions: "제공된 <evidence> 근거 안에서만 한국어 평문으로 답하세요. 근거가 부족하면 모른다고 답하세요. 도구를 호출하지 마세요.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `<question>\n${question}\n</question>\n\n<evidence-set>\n${context}\n</evidence-set>`,
          },
        ],
      },
    ],
  };
  const response = await fetch(`${requiredEnv("MODEL_API_BASE_URL").replace(/\/$/, "")}/v1/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Model API HTTP ${response.status}`), { code: "model_unavailable" });
  }
  const payload = await response.json();
  if (JSON.stringify(payload).includes('"function_call"')) {
    throw Object.assign(new Error("Model API returned a function_call"), { code: "model_unavailable" });
  }
  return extractOutputText(payload);
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, timer };
}

async function handleAsk(req, res) {
  const id = requestId();
  const started = Date.now();
  let status = 200;
  let qmdMs = 0;
  let modelMs = 0;
  let evidenceCount = 0;

  if (inFlight) {
    status = 429;
    json(res, status, { requestId: id, error: errorDetails("busy") });
    logSafe({ requestId: id, status, qmdMs, modelMs, evidenceCount });
    return;
  }
  inFlight = true;

  try {
    const body = await readJsonBody(req);
    const question = validateQuestion(body);
    const qmdTimer = timeoutSignal(QMD_TIMEOUT_MS);
    let qmdPayload;
    const qmdStarted = Date.now();
    try {
      qmdPayload = await queryQmd({
        baseUrl: requiredEnv("BRAIN_QMD_URL"),
        query: question,
        collections: ["brain-wiki", "brain-private"],
        limit: 8,
        rerank: false,
        signal: qmdTimer.controller.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw Object.assign(new Error("qmd timeout"), { code: "retrieval_unavailable" });
      }
      throw Object.assign(error, { code: "retrieval_unavailable" });
    } finally {
      clearTimeout(qmdTimer.timer);
      qmdMs = Date.now() - qmdStarted;
    }

    const normalized = normalizeQmdResults(qmdPayload, {
      publicWikiRoot: requiredEnv("BRAIN_PUBLIC_WIKI_ROOT"),
      privateWikiRoot: requiredEnv("BRAIN_PRIVATE_WIKI_ROOT"),
    });
    const { context, sources } = await selectEvidence(normalized, readLimitedFile);
    evidenceCount = sources.length;
    if (sources.length === 0) {
      json(res, status, { requestId: id, answer: "", sources: [] });
      return;
    }

    const modelTimer = timeoutSignal(MODEL_TIMEOUT_MS);
    const modelStarted = Date.now();
    try {
      const answer = await callModel({ question, context, signal: modelTimer.controller.signal });
      json(res, status, { requestId: id, answer, sources });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw Object.assign(new Error("Model API timeout"), { code: "model_timeout" });
      }
      throw error;
    } finally {
      clearTimeout(modelTimer.timer);
      modelMs = Date.now() - modelStarted;
    }
  } catch (error) {
    const code = error && error.code ? error.code : "model_unavailable";
    status = code === "invalid_question" ? 400
      : code === "busy" ? 429
        : code === "retrieval_unavailable" ? 502
          : code === "model_timeout" ? 504
            : 502;
    json(res, status, { requestId: id, error: errorDetails(code) });
  } finally {
    inFlight = false;
    logSafe({ requestId: id, status, qmdMs, modelMs, evidenceCount, totalMs: Date.now() - started });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && req.url === "/ask") {
    void handleAsk(req, res);
    return;
  }
  json(res, 404, { error: { code: "not_found" } });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, "0.0.0.0", () => {
    process.stdout.write(`brain-ask listening on ${PORT}\n`);
  });
}

export { server };
