import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { escapeEvidenceAttribute, extractOutputText, normalizeQmdResults, parseQmdUri, selectEvidence, validateQuestion } from "./brainAsk.mjs";

async function tempBrain() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "brain-ask-"));
  const publicWiki = path.join(root, "public", "wiki");
  const privateWiki = path.join(root, "private", "wiki");
  await fs.mkdir(path.join(publicWiki, "concepts"), { recursive: true });
  await fs.mkdir(path.join(privateWiki, "entities"), { recursive: true });
  await fs.writeFile(path.join(publicWiki, "concepts", "agent.md"), "# Agent\npublic body\n");
  await fs.writeFile(path.join(privateWiki, "entities", "style.md"), "# Style\nprivate body\n");
  return { root, publicWiki, privateWiki };
}

function postJson(port, body, contentType = "application/json") {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        method: "POST",
        port,
        path: "/ask",
        headers: {
          "content-type": contentType,
          "content-length": Buffer.byteLength(data),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(data);
  });
}

function postJsonWithDelayedBody(port, body, delayMs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        method: "POST",
        port,
        path: "/ask",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(data),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          }),
        );
      },
    );
    req.on("error", reject);
    req.flushHeaders();
    setTimeout(() => req.end(data), delayMs);
  });
}

function startJsonServer(handler) {
  const server = http.createServer(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: String(error && error.message ? error.message : error),
        }),
      );
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("validateQuestion trims and enforces 1..500 characters", () => {
  assert.equal(validateQuestion({ question: "  hello  " }), "hello");
  assert.equal(validateQuestion({ question: "x".repeat(500) }), "x".repeat(500));
  assert.throws(() => validateQuestion({ question: "" }), /invalid_question/);
  assert.throws(() => validateQuestion({ question: "x".repeat(501) }), /invalid_question/);
  assert.throws(() => validateQuestion({ question: 1 }), /invalid_question/);
});

test("parseQmdUri allows wiki collections and rejects traversal, raw, absolute and symlink escape", async () => {
  const brain = await tempBrain();
  try {
    assert.deepEqual(
      parseQmdUri("qmd://brain-wiki/concepts/agent.md", {
        publicWikiRoot: brain.publicWiki,
        privateWikiRoot: brain.privateWiki,
      }),
      {
        namespace: "public",
        relativePath: "concepts/agent.md",
        slug: "concepts/agent",
        href: "/concepts/agent",
        absolutePath: await fs.realpath(path.join(brain.publicWiki, "concepts", "agent.md")),
      },
    );
    assert.equal(
      parseQmdUri("qmd://brain-private/entities/style.md", {
        publicWikiRoot: brain.publicWiki,
        privateWikiRoot: brain.privateWiki,
      }).href,
      "/_private/entities/style",
    );
    assert.throws(
      () =>
        parseQmdUri("qmd://brain-raw/source.md", {
          publicWikiRoot: brain.publicWiki,
        }),
      /not allowed/,
    );
    assert.throws(
      () =>
        parseQmdUri("qmd://brain-wiki/../secret.md", {
          publicWikiRoot: brain.publicWiki,
        }),
      /escapes/,
    );
    assert.throws(
      () =>
        parseQmdUri("qmd://brain-wiki/%2Fetc/passwd", {
          publicWikiRoot: brain.publicWiki,
        }),
      /relative/,
    );

    const outside = path.join(brain.root, "outside.md");
    await fs.writeFile(outside, "outside");
    const link = path.join(brain.publicWiki, "concepts", "outside.md");
    if (fsSync.symlinkSync) {
      await fs.symlink(outside, link);
      assert.throws(
        () =>
          parseQmdUri("qmd://brain-wiki/concepts/outside.md", {
            publicWikiRoot: brain.publicWiki,
            privateWikiRoot: brain.privateWiki,
          }),
        /outside/,
      );
    }
  } finally {
    await fs.rm(brain.root, { recursive: true, force: true });
  }
});

test("selectEvidence preserves qmd order and caps file and total context size", async () => {
  const brain = await tempBrain();
  try {
    const bigText = "a".repeat(10 * 1024);
    for (let i = 0; i < 7; i += 1) {
      await fs.writeFile(path.join(brain.publicWiki, `doc-${i}.md`), bigText);
    }
    const normalized = normalizeQmdResults(
      {
        results: Array.from({ length: 7 }, (_, index) => ({
          uri: `qmd://brain-wiki/doc-${index}.md`,
          title: `Doc ${index}`,
          score: 1 - index / 10,
          excerpt: `excerpt-${index}`,
        })),
      },
      { publicWikiRoot: brain.publicWiki, privateWikiRoot: brain.privateWiki },
    );
    const { context, sources } = await selectEvidence(normalized, async (file, { maxBytes }) => {
      const content = await fs.readFile(file, "utf8");
      return content.slice(0, maxBytes);
    });

    assert.equal(sources.length, 4);
    assert.equal((context.match(/<evidence index=/g) || []).length, 4);
    assert.equal(context.split("a".repeat(8192)).length - 1, 4);
    assert.deepEqual(
      sources.map((source) => source.title),
      ["Doc 0", "Doc 1", "Doc 2", "Doc 3"],
    );
    assert.equal(context.includes("doc-4"), false);
  } finally {
    await fs.rm(brain.root, { recursive: true, force: true });
  }
});

test("selectEvidence escapes evidence metadata attributes without changing source slugs", async () => {
  const brain = await tempBrain();
  try {
    const file = path.join(brain.publicWiki, "concepts", "weird.md");
    await fs.writeFile(file, "body");
    const unsafeSlug = "concepts/%22%3Cline\n\u0001";
    const { context, sources } = await selectEvidence(
      {
        results: [
          {
            absolutePath: file,
            namespace: "public",
            slug: unsafeSlug,
            href: "/concepts/weird",
            title: "Weird",
          },
        ],
      },
      async (target) => fs.readFile(target, "utf8"),
    );
    const openingTag = context.split("\n")[0];
    assert.equal(sources[0].slug, unsafeSlug);
    assert.equal(openingTag.includes('slug="concepts/%22%3Cline'), true);
    assert.equal(openingTag.includes('"%3Cline\n'), false);
    assert.equal(openingTag.includes("<line"), false);
    assert.equal(openingTag.includes("\n"), false);
    assert.equal(openingTag.includes("\u0001"), false);
    assert.equal(openingTag.includes("&#xA;"), true);
    assert.equal(openingTag.includes("&#x1;"), true);
    assert.equal(escapeEvidenceAttribute('quoted" <tag> & value\n\u0001'), "quoted&quot; &lt;tag&gt; &amp; value&#xA;&#x1;");
  } finally {
    await fs.rm(brain.root, { recursive: true, force: true });
  }
});

test("selectEvidence enforces byte limits even when readFile ignores maxBytes", async () => {
  const brain = await tempBrain();
  try {
    await fs.writeFile(path.join(brain.publicWiki, "multibyte.md"), "가".repeat(4096));
    const normalized = normalizeQmdResults(
      {
        results: [{ uri: "qmd://brain-wiki/multibyte.md" }],
      },
      { publicWikiRoot: brain.publicWiki, privateWikiRoot: brain.privateWiki },
    );
    const { context } = await selectEvidence(normalized, async (file) => fs.readFile(file, "utf8"));
    const body = context.match(/>\n([\s\S]*)\n<\/evidence>/)[1];
    assert.equal(Buffer.byteLength(body, "utf8") <= 8 * 1024, true);
    assert.equal(body.endsWith("\uFFFD"), false);
  } finally {
    await fs.rm(brain.root, { recursive: true, force: true });
  }
});

test("extractOutputText only returns completed Responses output text", () => {
  assert.equal(extractOutputText({ status: "in_progress", output_text: "no" }), "");
  assert.equal(extractOutputText({ status: "completed", output_text: "plain" }), "plain");
  assert.equal(
    extractOutputText({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "hello " },
            { type: "text", text: "world" },
          ],
        },
        { type: "function_call", name: "search" },
      ],
    }),
    "hello world",
  );
});

test("server handles answer, empty search, bad input, busy, upstream errors and safe logs", async () => {
  const brain = await tempBrain();
  const keyFile = path.join(brain.root, "key");
  await fs.writeFile(keyFile, "secret-key\n", { mode: 0o600 });
  const logs = [];
  const originalStdout = process.stdout.write;
  process.stdout.write = (chunk, ...args) => {
    logs.push(String(chunk));
    return originalStdout.call(process.stdout, chunk, ...args);
  };

  let qmdMode = "normal";
  let modelCalls = 0;
  let modelMode = "normal";
  let lastModelRequestBody;
  const qmd = await startJsonServer(async (req, res) => {
    if (qmdMode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (qmdMode === "error") {
      res.writeHead(503, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        results:
          qmdMode === "empty"
            ? []
            : [
                {
                  uri: "qmd://brain-wiki/concepts/agent.md",
                  title: "Agent",
                  score: 0.9,
                  excerpt: "public excerpt",
                },
              ],
      }),
    );
  });
  const modelApi = await startJsonServer(async (req, res) => {
    modelCalls += 1;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const requestBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    lastModelRequestBody = requestBody;
    assert.equal(req.headers.authorization, "Bearer secret-key");
    assert.equal(requestBody.model, "brain");
    assert.equal(requestBody.store, false);
    assert.equal(requestBody.max_output_tokens, 12);
    assert.equal(Object.hasOwn(requestBody, "previous_response_id"), false);
    assert.equal(Object.hasOwn(requestBody, "conversation"), false);
    assert.equal(Object.hasOwn(requestBody, "tools"), false);
    if (modelMode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (modelMode === "error") {
      res.writeHead(503, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    if (modelMode === "largeBody") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "completed", output_text: "x".repeat(1000) }));
      return;
    }
    if (modelMode === "tooLargeBody") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "completed", output_text: "x".repeat(2000) }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "completed", output_text: "근거 기반 답변" }));
  });

  process.env.BRAIN_QMD_URL = `http://127.0.0.1:${qmd.address().port}`;
  process.env.MODEL_API_BASE_URL = `http://127.0.0.1:${modelApi.address().port}`;
  process.env.MODEL_API_KEY_FILE = keyFile;
  process.env.BRAIN_PUBLIC_WIKI_ROOT = brain.publicWiki;
  process.env.BRAIN_PRIVATE_WIKI_ROOT = brain.privateWiki;
  process.env.PORT = "0";
  process.env.BRAIN_QMD_TIMEOUT_MS = "50";
  process.env.MODEL_TIMEOUT_MS = "50";
  process.env.BRAIN_ASK_BODY_TIMEOUT_MS = "40";
  process.env.MODEL_MAX_OUTPUT_TOKENS = "12";
  process.env.MODEL_MAX_RESPONSE_BYTES = "1536";
  process.env.BRAIN_ASK_MAX_ANSWER_CHARS = "20";
  const { server } = await import("./server.mjs");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    let response = await postJson(
      server.address().port,
      { question: "내 작업 방식?" },
      "application/json; charset=utf-8",
    );
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.requestId, "string");
    assert.equal(response.body.answer, "근거 기반 답변");
    assert.equal(response.body.sources[0].href, "/concepts/agent");
    assert.equal(lastModelRequestBody.max_output_tokens, 12);

    qmdMode = "empty";
    modelCalls = 0;
    response = await postJson(server.address().port, { question: "없는 질문" });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.requestId, "string");
    assert.equal(response.body.answer, "");
    assert.deepEqual(response.body.sources, []);
    assert.equal(modelCalls, 0);

    response = await postJson(server.address().port, { question: "" });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "invalid_question");
    assert.equal(response.body.error.retryable, false);

    response = await postJson(server.address().port, { question: "잘못된 미디어 타입" }, "text/plain");
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "invalid_question");
    assert.equal(response.body.error.retryable, false);

    qmdMode = "normal";
    modelMode = "normal";
    const [slowBody, normalBody] = await Promise.all([postJsonWithDelayedBody(server.address().port, { question: "느린 본문" }, 80), postJson(server.address().port, { question: "정상 본문" })]);
    assert.equal(slowBody.status, 400);
    assert.equal(slowBody.body.error.code, "invalid_question");
    assert.equal(normalBody.status, 200);
    assert.notEqual(normalBody.body.error?.code, "busy");

    qmdMode = "slow";
    const [first, second] = await Promise.all([postJson(server.address().port, { question: "느린 질문" }), postJson(server.address().port, { question: "동시 질문" })]);
    assert.equal([first.status, second.status].includes(429), true);

    qmdMode = "error";
    response = await postJson(server.address().port, { question: "qmd 장애" });
    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, "retrieval_unavailable");
    assert.equal(response.body.error.retryable, true);

    qmdMode = "slow";
    response = await postJson(server.address().port, {
      question: "qmd 시간 초과",
    });
    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, "retrieval_unavailable");

    qmdMode = "normal";
    modelMode = "error";
    response = await postJson(server.address().port, { question: "모델 장애" });
    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, "model_unavailable");

    modelMode = "slow";
    response = await postJson(server.address().port, {
      question: "모델 시간 초과",
    });
    assert.equal(response.status, 504);
    assert.equal(response.body.error.code, "model_timeout");

    modelMode = "largeBody";
    response = await postJson(server.address().port, { question: "긴 답변" });
    assert.equal(response.status, 200);
    assert.equal(response.body.answer.length, 20);

    modelMode = "tooLargeBody";
    response = await postJson(server.address().port, {
      question: "너무 큰 모델 응답",
    });
    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, "model_unavailable");

    assert.equal(logs.join("").includes("내 작업 방식"), false);
    assert.equal(logs.join("").includes("근거 기반 답변"), false);
    assert.equal(logs.join("").includes("public excerpt"), false);
    assert.equal(logs.join("").includes("secret-key"), false);
  } finally {
    process.stdout.write = originalStdout;
    server.closeAllConnections();
    qmd.closeAllConnections();
    modelApi.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => qmd.close(resolve));
    await new Promise((resolve) => modelApi.close(resolve));
    await fs.rm(brain.root, { recursive: true, force: true });
  }
});
