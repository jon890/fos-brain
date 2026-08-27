import fs from "node:fs";
import path from "node:path";

const ALLOWED_COLLECTIONS = new Map([
  ["brain-wiki", { namespace: "public", rootKey: "publicWikiRoot", hrefPrefix: "" }],
  [
    "brain-private",
    {
      namespace: "private",
      rootKey: "privateWikiRoot",
      hrefPrefix: "/_private",
    },
  ],
]);

const MAX_EVIDENCE_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024;

export function escapeEvidenceAttribute(value) {
  return String(value).replace(/[&"<>\u0000-\u001F\u007F]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return `&#x${char.codePointAt(0).toString(16).toUpperCase()};`;
    }
  });
}

export function validateQuestion(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("invalid_question"), {
      code: "invalid_question",
    });
  }
  if (typeof body.question !== "string") {
    throw Object.assign(new Error("invalid_question"), {
      code: "invalid_question",
    });
  }
  const question = body.question.trim();
  if (question.length < 1 || question.length > 500) {
    throw Object.assign(new Error("invalid_question"), {
      code: "invalid_question",
    });
  }
  return question;
}

function qmdUriFromResult(result) {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  for (const key of ["uri", "url", "file", "id", "resource"]) {
    if (typeof result[key] === "string" && result[key].startsWith("qmd://")) {
      return result[key];
    }
  }
  return "";
}

function decodeRelativePath(uriPath) {
  let decoded;
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

function realRoot(root) {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("wiki root is required");
  }
  return fs.realpathSync(root);
}

export function parseQmdUri(file, roots) {
  const uri = qmdUriFromResult(file);
  const match = uri.match(/^qmd:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error("qmd uri is required");
  }

  const [, collection, uriPath] = match;
  const config = ALLOWED_COLLECTIONS.get(collection);
  if (!config) {
    throw new Error(`qmd collection is not allowed: ${collection}`);
  }

  const relativePath = decodeRelativePath(uriPath);
  const root = realRoot(roots[config.rootKey] || roots[collection] || roots[config.namespace]);
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
  const href = `${config.hrefPrefix}/${slug}`.replace(/\/{2,}/g, "/");
  return {
    namespace: config.namespace,
    relativePath: relativePath.replace(/\\/g, "/"),
    slug,
    href,
    absolutePath: resolvedPath,
  };
}

function qmdResults(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function titleFromResult(result, parsed) {
  if (result && typeof result === "object" && typeof result.title === "string" && result.title.trim()) {
    return result.title.trim();
  }
  const base = path.basename(parsed.slug);
  return base || parsed.slug;
}

function excerptFromResult(result) {
  if (!result || typeof result !== "object") return "";
  for (const key of ["excerpt", "snippet", "text", "content"]) {
    if (typeof result[key] === "string") {
      return result[key].slice(0, 500);
    }
  }
  return "";
}

function scoreFromResult(result) {
  if (!result || typeof result !== "object") return null;
  return typeof result.score === "number" && Number.isFinite(result.score) ? result.score : null;
}

function truncateUtf8(value, maxBytes) {
  const buffer = Buffer.from(String(value), "utf8");
  if (buffer.length <= maxBytes) return buffer.toString("utf8");
  return buffer
    .subarray(0, maxBytes)
    .toString("utf8")
    .replace(/\uFFFD$/, "");
}

export async function selectEvidence(results, readFile) {
  const sources = [];
  const contextParts = [];
  let totalBytes = 0;

  for (const result of qmdResults(results)) {
    if (sources.length >= MAX_EVIDENCE_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
    const parsed = result.absolutePath && result.namespace && result.slug && result.href ? result : parseQmdUri(result, result.roots || results.roots || {});
    const remainingBytes = Math.min(MAX_FILE_BYTES, MAX_TOTAL_BYTES - totalBytes);
    if (remainingBytes <= 0) break;

    const raw = await readFile(parsed.absolutePath, {
      encoding: "utf8",
      maxBytes: remainingBytes,
    });
    const text = truncateUtf8(raw, remainingBytes);
    const bytes = Buffer.byteLength(text, "utf8");
    totalBytes += bytes;

    const source = {
      title: titleFromResult(result, parsed),
      slug: parsed.slug,
      namespace: parsed.namespace,
      score: scoreFromResult(result),
      excerpt: excerptFromResult(result),
      href: parsed.href,
    };
    sources.push(source);
    contextParts.push([`<evidence index="${sources.length}" namespace="${escapeEvidenceAttribute(source.namespace)}" slug="${escapeEvidenceAttribute(source.slug)}">`, text, "</evidence>"].join("\n"));
  }

  return { context: contextParts.join("\n\n"), sources };
}

export function extractOutputText(response) {
  if (!response || typeof response !== "object") return "";
  if (response.status && response.status !== "completed") return "";
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";

  const texts = [];
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    if (item.type === "function_call") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
  }
  return texts.join("");
}

export function normalizeQmdResults(payload, roots) {
  return qmdResults(payload).map((result) => {
    const parsed = parseQmdUri(result, roots);
    return { ...result, ...parsed };
  });
}
