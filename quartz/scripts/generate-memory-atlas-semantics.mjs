#!/usr/bin/env node
import fs from "node:fs/promises"
import http from "node:http"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"
import matter from "gray-matter"

const schemaVersion = 1
const source = "qmd-vector"
const allowedCollectionsByScope = {
  public: new Set(["brain-wiki"]),
  protected: new Set(["brain-wiki", "brain-private"]),
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv, env)
  await generateMemoryAtlasSemantics(options)
}

export function parseArgs(argv, env = process.env) {
  const parsed = {
    scope: undefined,
    output: undefined,
    collections: new Map(),
    limit: 8,
    minScore: 0.2,
    timeoutMs: 10_000,
    qmdUrl: env.BRAIN_QMD_URL,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) {
        throw new Error(`missing_value:${arg}`)
      }
      index += 1
      return value
    }

    if (arg === "--scope") parsed.scope = next()
    else if (arg === "--out") parsed.output = next()
    else if (arg === "--collection") {
      const value = next()
      const separator = value.indexOf("=")
      if (separator <= 0 || separator === value.length - 1) {
        throw new Error("invalid_collection_mapping")
      }
      parsed.collections.set(value.slice(0, separator), path.resolve(value.slice(separator + 1)))
    } else if (arg === "--limit") parsed.limit = parseInteger(next(), "limit")
    else if (arg === "--min-score") parsed.minScore = parseNumber(next(), "min_score")
    else if (arg === "--timeout-ms") parsed.timeoutMs = parseInteger(next(), "timeout_ms")
    else if (arg === "--qmd-url") parsed.qmdUrl = next()
    else throw new Error(`unknown_arg:${arg}`)
  }

  if (parsed.scope !== "public" && parsed.scope !== "protected") throw new Error("invalid_scope")
  if (!parsed.output) throw new Error("missing_output")
  if (!parsed.qmdUrl) throw new Error("missing_qmd_url")
  if (parsed.limit < 1 || parsed.limit > 20) throw new Error("invalid_limit")
  if (parsed.minScore < 0 || parsed.minScore > 1) throw new Error("invalid_min_score")
  if (parsed.timeoutMs < 1) throw new Error("invalid_timeout_ms")

  const allowed = allowedCollectionsByScope[parsed.scope]
  if (parsed.collections.size === 0) throw new Error("missing_collections")
  for (const collection of parsed.collections.keys()) {
    if (!allowed.has(collection)) throw new Error(`collection_not_allowed:${collection}`)
  }
  for (const collection of allowed) {
    if (!parsed.collections.has(collection)) throw new Error(`missing_collection:${collection}`)
  }

  return parsed
}

export async function generateMemoryAtlasSemantics(options) {
  await fs.rm(options.output, { force: true })
  const documents = await readWikiDocuments(options.collections)
  const edgeByKey = new Map()

  for (const document of documents) {
    const query = buildDocumentQuery(document)
    if (!query) continue

    const response = await queryQmd({
      qmdUrl: options.qmdUrl,
      query,
      collections: [...options.collections.keys()],
      limit: options.limit,
      timeoutMs: options.timeoutMs,
    })

    for (const result of response.results) {
      const target = slugFromQmdResult(result.file, options.collections)
      if (!target || target === document.slug) continue
      if (
        typeof result.score !== "number" ||
        !Number.isFinite(result.score) ||
        result.score < 0 ||
        result.score > 1
      ) {
        throw new Error("invalid_result_score")
      }
      if (result.score < options.minScore) continue

      const [sourceSlug, targetSlug] = normalizePair(document.slug, target)
      const key = `${sourceSlug}\u0000${targetSlug}`
      const existing = edgeByKey.get(key)
      if (!existing || result.score > existing.score) {
        edgeByKey.set(key, { source: sourceSlug, target: targetSlug, score: result.score })
      }
    }
  }

  const artifact = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    scope: options.scope,
    source,
    edges: [...edgeByKey.values()].sort(compareEdges),
  }

  await atomicWriteJson(options.output, artifact)
  return artifact
}

export async function readWikiDocuments(collections) {
  const documents = []
  for (const [collection, root] of collections) {
    const files = await listMarkdownFiles(root)
    for (const file of files) {
      const relativePath = toPosix(path.relative(root, file))
      assertSafeRelativePath(collection, relativePath)
      const slug = slugFromRelativePath(collection, relativePath)
      const raw = await fs.readFile(file, "utf8")
      const parsed = matter(raw)
      documents.push({
        collection,
        slug,
        title: stringValue(parsed.data.title),
        description: stringValue(parsed.data.description),
        tags: arrayOfStrings(parsed.data.tags),
      })
    }
  }

  return documents.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function buildDocumentQuery(document) {
  return [document.title, document.description, ...document.tags].filter(Boolean).join("\n").trim()
}

export function slugFromQmdResult(file, collections) {
  if (typeof file !== "string") throw new Error("invalid_result_file")
  const match = /^qmd:\/\/([^/]+)\/(.+)$/.exec(file)
  if (!match) throw new Error("invalid_result_file")

  const [, collection, encodedPath] = match
  if (!collections.has(collection)) throw new Error(`collection_not_allowed:${collection}`)
  const relativePath = decodeURIComponent(encodedPath)
  assertSafeRelativePath(collection, relativePath)
  return slugFromRelativePath(collection, relativePath)
}

function slugFromRelativePath(collection, relativePath) {
  const normalizedPath = toPosix(relativePath).replace(/^\//, "")
  if (!normalizedPath.endsWith(".md")) throw new Error(`not_markdown:${collection}`)
  const withoutExtension = normalizedPath.slice(0, -".md".length)
  const slug = withoutExtension
    .split("/")
    .map((segment) =>
      segment
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/\?/g, "")
        .replace(/#/g, ""),
    )
    .join("/")
    .replace(/\/$/, "")

  assertSafeSlug(collection, slug)

  return collection === "brain-private" ? `_private/${slug}` : slug
}

async function queryQmd({ qmdUrl, query, collections, limit, timeoutMs }) {
  const url = new URL("/query", qmdUrl)
  const response = await postJson(
    url,
    {
      searches: [{ type: "vec", query }],
      collections,
      limit,
      rerank: false,
    },
    timeoutMs,
  )

  if (!response || !Array.isArray(response.results)) throw new Error("invalid_qmd_response")
  return response
}

async function postJson(url, body, timeoutMs) {
  const payload = JSON.stringify(body)
  const transport = url.protocol === "https:" ? https : http

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`qmd_http:${response.statusCode ?? "unknown"}`))
            return
          }

          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
          } catch {
            reject(new Error("invalid_qmd_json"))
          }
        })
      },
    )

    request.on("timeout", () => {
      request.destroy(new Error("qmd_timeout"))
    })
    request.on("error", reject)
    request.write(payload)
    request.end()
  })
}

async function listMarkdownFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath)
    }
  }

  return files.sort((a, b) => a.localeCompare(b))
}

async function atomicWriteJson(output, artifact) {
  const outputDir = path.dirname(output)
  await fs.mkdir(outputDir, { recursive: true })
  const tempDir = await fs.mkdtemp(path.join(outputDir, ".memory-atlas-semantics-"))
  const tempFile = path.join(tempDir, path.basename(output))
  try {
    await fs.writeFile(tempFile, `${JSON.stringify(artifact, null, 2)}\n`)
    await fs.rename(tempFile, output)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

function normalizePair(sourceSlug, targetSlug) {
  return sourceSlug.localeCompare(targetSlug) <= 0
    ? [sourceSlug, targetSlug]
    : [targetSlug, sourceSlug]
}

function compareEdges(a, b) {
  return a.source.localeCompare(b.source) || a.target.localeCompare(b.target)
}

function toPosix(value) {
  return value.split(path.sep).join("/")
}

function isOutsideRoot(relativePath) {
  return (
    relativePath.startsWith("../") ||
    relativePath === ".." ||
    path.isAbsolute(relativePath) ||
    relativePath.split("/").includes("..")
  )
}

function assertSafeRelativePath(collection, relativePath) {
  if (
    isOutsideRoot(relativePath) ||
    relativePath.includes("\\") ||
    hasAsciiControlCharacter(relativePath) ||
    relativePath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error(`path_outside_root:${collection}`)
  }
}

function assertSafeSlug(collection, slug) {
  if (
    slug.length === 0 ||
    slug.startsWith("/") ||
    slug.endsWith("/") ||
    slug.startsWith(".") ||
    slug.includes(" ") ||
    slug.includes("#") ||
    slug.includes("?") ||
    slug.includes("&") ||
    slug.includes("\\") ||
    hasAsciiControlCharacter(slug) ||
    slug.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`invalid_slug:${collection}`)
  }
}

function hasAsciiControlCharacter(value) {
  return /[\u0000-\u001F\u007F]/u.test(value)
}

function stringValue(value) {
  return typeof value === "string" ? value : ""
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []
}

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) throw new Error(`invalid_${name}`)
  return parsed
}

function parseNumber(value, name) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`invalid_${name}`)
  return parsed
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        error: "memory_atlas_semantics_generation_failed",
        reason: error instanceof Error ? error.message : "unknown",
      }),
    )
    process.exitCode = 1
  })
}
