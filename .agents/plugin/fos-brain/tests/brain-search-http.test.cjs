const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseCollections,
  parseLimit,
  queryQmd,
  queryHttp,
  run,
} = require("../scripts/brain-search-http.cjs");

function response({ status = 200, body = {}, jsonError = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (jsonError) throw jsonError;
      return body;
    },
  };
}

test("posts official qmd query shape and returns JSON", async () => {
  const calls = [];
  const result = await queryHttp({
    baseUrl: "http://qmd.internal.test/",
    question: 'agent "workflow"',
    collections: ["brain-wiki", "brain-private"],
    limit: 7,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({
        body: {
          results: [
            { uri: "qmd://brain-wiki/concepts/agent.md", text: "public" },
            { url: "qmd://brain-private/concepts/style.md", text: "private" },
          ],
        },
      });
    },
  });

  assert.deepEqual(result.results.map((item) => item.text), ["public", "private"]);
  assert.equal(calls[0].url, "http://qmd.internal.test/query");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["content-type"], "application/json");
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload.searches, [
    { type: "lex", query: 'agent "workflow"' },
    { type: "vec", query: 'agent "workflow"' },
  ]);
  assert.deepEqual(payload.collections, ["brain-wiki", "brain-private"]);
  assert.equal(Object.hasOwn(payload, "collection"), false);
  assert.equal(payload.limit, 7);
  assert.equal(payload.rerank, false);
});

test("queryQmd accepts query, rerank and external abort signal", async () => {
  const controller = new AbortController();
  const calls = [];
  const result = await queryQmd({
    baseUrl: "http://qmd.internal.test",
    query: "agent workflow",
    collections: ["brain-wiki"],
    limit: 3,
    rerank: true,
    signal: controller.signal,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({ body: { results: [{ uri: "qmd://brain-wiki/INDEX.md" }] } });
    },
  });

  assert.equal(result.results[0].uri, "qmd://brain-wiki/INDEX.md");
  const payload = JSON.parse(calls[0].options.body);
  assert.equal(payload.rerank, true);
  assert.equal(calls[0].options.signal, controller.signal);
});

test("rejects timeout", async () => {
  await assert.rejects(
    queryHttp({
      baseUrl: "http://qmd.internal.test",
      question: "slow",
      collections: ["brain-wiki"],
      limit: 5,
      timeoutMs: 1,
      fetchImpl: (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    }),
    /timed out/,
  );
});

test("rejects non-2xx and invalid JSON", async () => {
  await assert.rejects(
    queryHttp({
      baseUrl: "http://qmd.internal.test",
      question: "bad status",
      collections: ["brain-wiki"],
      limit: 5,
      fetchImpl: async () => response({ status: 503 }),
    }),
    /HTTP 503/,
  );

  await assert.rejects(
    queryHttp({
      baseUrl: "http://qmd.internal.test",
      question: "bad json",
      collections: ["brain-wiki"],
      limit: 5,
      fetchImpl: async () => response({ jsonError: new Error("not json") }),
    }),
    /invalid JSON/,
  );
});

test("rejects disallowed response collections", async () => {
  await assert.rejects(
    queryHttp({
      baseUrl: "http://qmd.internal.test",
      question: "leak",
      collections: ["brain-wiki"],
      limit: 5,
      fetchImpl: async () =>
        response({
          body: {
            nested: {
              resource: "qmd://brain-private/raw/secret.md",
            },
          },
        }),
    }),
    /disallowed collection: brain-private/,
  );

  await assert.rejects(
    queryHttp({
      baseUrl: "http://qmd.internal.test",
      question: "actual qmd response shape",
      collections: ["brain-wiki"],
      limit: 5,
      fetchImpl: async () =>
        response({
          body: {
            results: [{ file: "qmd://brain-private/entities/private.md" }],
          },
        }),
    }),
    /disallowed collection: brain-private/,
  );
});

test("validates collection and limit inputs", () => {
  assert.deepEqual(parseCollections('["brain-wiki","brain-wiki","brain-raw"]'), ["brain-wiki", "brain-raw"]);
  assert.throws(() => parseCollections('["private-raw"]'), /not allowed/);
  assert.equal(parseLimit("1"), 1);
  assert.equal(parseLimit("20"), 20);
  assert.throws(() => parseLimit("0"), /between 1 and 20/);
  assert.throws(() => parseLimit("21"), /between 1 and 20/);
});

test("run preserves CLI JSON output contract", async () => {
  const originalFetch = global.fetch;
  const chunks = [];
  global.fetch = async () =>
    response({
      body: {
        results: [{ uri: "qmd://brain-wiki/INDEX.md", text: "ok" }],
      },
    });
  try {
    await run(['agent "workflow"', '["brain-wiki"]', "1"], { BRAIN_QMD_URL: "http://qmd.internal.test" }, {
      stdout: { write: (chunk) => chunks.push(chunk) },
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(JSON.parse(chunks.join("")).results.map((item) => item.text), ["ok"]);
});
