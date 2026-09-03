import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { BrainNamespace, BrainSource, QmdPayload, QmdResult } from "./contracts.js";

const ALLOWED_COLLECTIONS = new Map<
  string,
  { namespace: BrainNamespace; rootKey: keyof WikiRoots; hrefPrefix: string }
>([
  ["brain-wiki", { namespace: "public" as const, rootKey: "publicWikiRoot", hrefPrefix: "" }],
  [
    "brain-private",
    {
      namespace: "private" as const,
      rootKey: "privateWikiRoot",
      hrefPrefix: "/_private",
    },
  ],
]);

const MAX_EVIDENCE_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024;

export interface WikiRoots {
  publicWikiRoot: string;
  privateWikiRoot: string;
}

export interface ParsedQmdResult extends QmdResult {
  absolutePath: string;
  namespace: BrainNamespace;
  relativePath: string;
  slug: string;
  href: string;
}

export type LimitedFileReader = (
  file: string,
  options: { encoding: BufferEncoding; maxBytes: number },
) => Promise<string>;

export function escapeEvidenceAttribute(value: unknown): string {
  return Array.from(String(value), (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default: {
        const codePoint = character.codePointAt(0);
        if (codePoint === undefined || (codePoint > 31 && codePoint !== 127)) return character;
        return `&#x${character.codePointAt(0)?.toString(16).toUpperCase()};`;
      }
    }
  }).join("");
}

function qmdUriFromResult(result: QmdResult | string): string {
  if (typeof result === "string") return result;
  for (const key of ["uri", "url", "file", "id", "resource"] as const) {
    const value = result[key];
    if (typeof value === "string" && value.startsWith("qmd://")) return value;
  }
  return "";
}

function decodeRelativePath(uriPath: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(uriPath);
  } catch {
    throw new Error("invalid qmd uri encoding");
  }
  if (!decoded || decoded.startsWith("/") || decoded.includes("\0")) {
    throw new Error("qmd uri path must be relative");
  }
  const parts = decoded.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("qmd uri path escapes the wiki root");
  }
  return parts.join(path.sep);
}

export function parseQmdUri(file: QmdResult | string, roots: WikiRoots): ParsedQmdResult {
  const uri = qmdUriFromResult(file);
  const match = /^qmd:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) throw new Error("qmd uri is required");

  const collection = match[1];
  const uriPath = match[2];
  if (!collection || !uriPath) throw new Error("qmd uri is required");
  const config = ALLOWED_COLLECTIONS.get(collection);
  if (!config) throw new Error(`qmd collection is not allowed: ${collection}`);

  const relativePath = decodeRelativePath(uriPath);
  const root = fs.realpathSync(roots[config.rootKey]);
  const absolutePath = path.resolve(root, relativePath);
  const relativeFromRoot = path.relative(root, absolutePath);
  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    throw new Error("qmd uri escapes the wiki root");
  }

  const resolvedPath = fs.realpathSync(absolutePath);
  const resolvedRelative = path.relative(root, resolvedPath);
  if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) {
    throw new Error("qmd uri resolves outside the wiki root");
  }

  const slug = relativePath.replace(/\\/g, "/").replace(/\.md$/i, "");
  return {
    ...(typeof file === "string" ? {} : file),
    namespace: config.namespace,
    relativePath: relativePath.replace(/\\/g, "/"),
    slug,
    href: `${config.hrefPrefix}/${slug}`.replace(/\/{2,}/g, "/"),
    absolutePath: resolvedPath,
  };
}

function qmdResults(payload: QmdPayload | QmdResult[]): QmdResult[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

export function normalizeQmdResults(
  payload: QmdPayload | QmdResult[],
  roots: WikiRoots,
): ParsedQmdResult[] {
  return qmdResults(payload).map((result) => ({ ...result, ...parseQmdUri(result, roots) }));
}

function truncateUtf8(value: unknown, maxBytes: number): string {
  const buffer = Buffer.from(String(value), "utf8");
  if (buffer.length <= maxBytes) return buffer.toString("utf8");
  return buffer.subarray(0, maxBytes).toString("utf8").replace(/\uFFFD$/, "");
}

function sourceFromResult(result: ParsedQmdResult): BrainSource {
  const excerpt = ["excerpt", "snippet", "text", "content"]
    .map((key) => result[key])
    .find((value) => typeof value === "string");
  return {
    title:
      typeof result.title === "string" && result.title.trim()
        ? result.title.trim()
        : path.basename(result.slug) || result.slug,
    slug: result.slug,
    namespace: result.namespace,
    score:
      typeof result.score === "number" && Number.isFinite(result.score) ? result.score : null,
    excerpt: typeof excerpt === "string" ? excerpt.slice(0, 500) : "",
    href: result.href,
  };
}

export async function readLimitedFile(
  file: string,
  { encoding, maxBytes }: { encoding: BufferEncoding; maxBytes: number },
): Promise<string> {
  const handle = await fsPromises.open(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString(encoding);
  } finally {
    await handle.close();
  }
}

export async function selectEvidence(
  results: ParsedQmdResult[],
  readFile: LimitedFileReader,
): Promise<{ context: string; sources: BrainSource[] }> {
  const sources: BrainSource[] = [];
  const contextParts: string[] = [];
  let totalBytes = 0;

  for (const result of results) {
    if (sources.length >= MAX_EVIDENCE_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
    const remainingBytes = Math.min(MAX_FILE_BYTES, MAX_TOTAL_BYTES - totalBytes);
    if (remainingBytes <= 0) break;
    const raw = await readFile(result.absolutePath, { encoding: "utf8", maxBytes: remainingBytes });
    const text = truncateUtf8(raw, remainingBytes);
    totalBytes += Buffer.byteLength(text, "utf8");
    const source = sourceFromResult(result);
    sources.push(source);
    contextParts.push(
      [
        `<evidence index="${sources.length}" namespace="${escapeEvidenceAttribute(source.namespace)}" slug="${escapeEvidenceAttribute(source.slug)}">`,
        text,
        "</evidence>",
      ].join("\n"),
    );
  }
  return { context: contextParts.join("\n\n"), sources };
}
