import assert from "node:assert"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import test, { afterEach, beforeEach, describe } from "node:test"
import {
  generateMemoryAtlasSemantics,
  parseArgs,
  slugFromQmdResult,
} from "./generate-memory-atlas-semantics.mjs"

let tempRoot
let server

describe("generate memory atlas semantics", () => {
  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "memory-atlas-semantics-test-"))
  })

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve))
      server = undefined
    }
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  test("generates normalized qmd vector edges without source text", async () => {
    const wikiRoot = path.join(tempRoot, "wiki")
    await writeMarkdown(wikiRoot, "concepts/rag.md", {
      title: "RAG",
      description: "Retrieval augmented generation",
      tags: ["ai", "retrieval"],
    })
    await writeMarkdown(wikiRoot, "concepts/graph-rag.md", {
      title: "GraphRAG",
      description: "Graph based retrieval",
      tags: ["ai", "retrieval"],
    })

    const requests = []
    const qmdUrl = await startQmdMock(async (body) => {
      requests.push(body)
      return {
        results: [
          { file: "qmd://brain-wiki/concepts/graph-rag.md", score: 0.81, title: "hidden" },
          { file: "qmd://brain-wiki/concepts/rag.md", score: 0.99 },
          { file: "qmd://brain-wiki/concepts/graph-rag.md", score: 0.91 },
          { file: "qmd://brain-wiki/concepts/low.md", score: 0.1 },
        ],
      }
    })

    const output = path.join(tempRoot, "out", "memory-atlas-semantics.json")
    const artifact = await generateMemoryAtlasSemantics({
      scope: "public",
      output,
      qmdUrl,
      collections: new Map([["brain-wiki", wikiRoot]]),
      limit: 5,
      minScore: 0.2,
      timeoutMs: 1000,
    })

    assert.strictEqual(requests.length, 2)
    assert.deepStrictEqual(requests[0].searches, [
      { type: "vec", query: "GraphRAG\nGraph based retrieval\nai\nretrieval" },
    ])
    assert.deepStrictEqual(requests[0].collections, ["brain-wiki"])
    assert.strictEqual(requests[0].rerank, false)
    assert.deepStrictEqual(artifact.edges, [
      { source: "concepts/graph-rag", target: "concepts/rag", score: 0.99 },
    ])

    const written = JSON.parse(await fs.readFile(output, "utf8"))
    assert.strictEqual(JSON.stringify(written).includes("hidden"), false)
    assert.strictEqual(JSON.stringify(written).includes("retrieval"), false)
  })

  test("supports protected public and private collection mappings", async () => {
    const wikiRoot = path.join(tempRoot, "wiki")
    const privateRoot = path.join(tempRoot, "private", "wiki")
    await writeMarkdown(wikiRoot, "concepts/rag.md", { title: "RAG" })
    await writeMarkdown(privateRoot, "entities/work.md", { title: "Work" })

    const qmdUrl = await startQmdMock(async () => ({
      results: [{ file: "qmd://brain-private/entities/work.md", score: 0.7 }],
    }))

    const artifact = await generateMemoryAtlasSemantics({
      scope: "protected",
      output: path.join(tempRoot, "out.json"),
      qmdUrl,
      collections: new Map([
        ["brain-wiki", wikiRoot],
        ["brain-private", privateRoot],
      ]),
      limit: 5,
      minScore: 0.2,
      timeoutMs: 1000,
    })

    assert.deepStrictEqual(artifact.edges, [
      { source: "_private/entities/work", target: "concepts/rag", score: 0.7 },
    ])
  })

  test("removes stale output and leaves no replacement on qmd timeout", async () => {
    const wikiRoot = path.join(tempRoot, "wiki")
    await writeMarkdown(wikiRoot, "concepts/rag.md", { title: "RAG" })
    const output = path.join(tempRoot, "out.json")
    await fs.writeFile(output, "stale")

    const qmdUrl = await startQmdMock(
      async () =>
        await new Promise((resolve) => {
          setTimeout(() => resolve({ results: [] }), 100)
        }),
    )

    await assert.rejects(
      generateMemoryAtlasSemantics({
        scope: "public",
        output,
        qmdUrl,
        collections: new Map([["brain-wiki", wikiRoot]]),
        limit: 5,
        minScore: 0.2,
        timeoutMs: 10,
      }),
      /qmd_timeout/,
    )
    await assert.rejects(fs.stat(output), /ENOENT/)
  })

  test("fails on qmd scores outside the artifact range and cleans temporary files", async () => {
    const wikiRoot = path.join(tempRoot, "wiki")
    await writeMarkdown(wikiRoot, "concepts/rag.md", { title: "RAG" })
    const outputDir = path.join(tempRoot, "out")
    const output = path.join(outputDir, "memory-atlas-semantics.json")

    const qmdUrl = await startQmdMock(async () => ({
      results: [{ file: "qmd://brain-wiki/concepts/graph-rag.md", score: 1.1 }],
    }))

    await assert.rejects(
      generateMemoryAtlasSemantics({
        scope: "public",
        output,
        qmdUrl,
        collections: new Map([["brain-wiki", wikiRoot]]),
        limit: 5,
        minScore: 0.2,
        timeoutMs: 1000,
      }),
      /invalid_result_score/,
    )

    await assert.rejects(fs.stat(output), /ENOENT/)
    const leftovers = await fs.readdir(outputDir).catch((error) => {
      if (error?.code === "ENOENT") return []
      throw error
    })
    assert.deepStrictEqual(
      leftovers.filter((entry) => entry.startsWith(".memory-atlas-semantics-")),
      [],
    )
  })

  test("fails on unallowed collection and root escaping qmd uri", () => {
    assert.throws(
      () => slugFromQmdResult("qmd://brain-raw/notes/source.md", new Map([["brain-wiki", "/tmp"]])),
      /collection_not_allowed:brain-raw/,
    )
    assert.throws(
      () =>
        slugFromQmdResult(
          "qmd://brain-wiki/../private/secret.md",
          new Map([["brain-wiki", "/tmp"]]),
        ),
      /path_outside_root:brain-wiki/,
    )
  })

  test("validates CLI scope, qmd URL, collection mappings, limits, and min score", () => {
    assert.deepStrictEqual(
      parseArgs(
        [
          "--scope",
          "public",
          "--out",
          path.join(tempRoot, "out.json"),
          "--collection",
          `brain-wiki=${path.join(tempRoot, "wiki")}`,
          "--limit",
          "3",
          "--min-score",
          "0.4",
          "--timeout-ms",
          "500",
        ],
        { BRAIN_QMD_URL: "http://127.0.0.1:3000" },
      ),
      {
        scope: "public",
        output: path.join(tempRoot, "out.json"),
        qmdUrl: "http://127.0.0.1:3000",
        collections: new Map([["brain-wiki", path.join(tempRoot, "wiki")]]),
        limit: 3,
        minScore: 0.4,
        timeoutMs: 500,
      },
    )

    assert.throws(
      () =>
        parseArgs(
          [
            "--scope",
            "public",
            "--out",
            path.join(tempRoot, "out.json"),
            "--collection",
            `brain-private=${path.join(tempRoot, "private", "wiki")}`,
          ],
          { BRAIN_QMD_URL: "http://127.0.0.1:3000" },
        ),
      /collection_not_allowed:brain-private/,
    )
  })
})

async function writeMarkdown(root, relativePath, frontmatter) {
  const file = path.join(root, relativePath)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n")
  await fs.writeFile(file, `---\n${yaml}\n---\n# ${frontmatter.title}\n`)
}

async function startQmdMock(handler) {
  server = http.createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/query") {
      response.writeHead(404).end()
      return
    }

    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    const payload = await handler(body)
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify(payload))
  })

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  return `http://127.0.0.1:${address.port}`
}
