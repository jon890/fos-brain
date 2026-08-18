#!/usr/bin/env node

const fs = require("node:fs/promises")
const path = require("node:path")
const process = require("node:process")

const TOOL_NAME = "fos-brain/okf-export"
const WIKI_TYPES = new Map([
  ["concepts", "concept"],
  ["topics", "topic"],
  ["entities", "entity"],
])

function usage() {
  return `Usage: node ${path.basename(__filename)} <repository-root> <output-path>`
}

function normalizePath(value) {
  return value.split(path.sep).join("/")
}

function markdownTarget(relativePath, fragment = "") {
  const encoded = normalizePath(relativePath)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  const prefix = encoded.startsWith(".") ? encoded : `./${encoded}`
  return fragment ? `${prefix}#${encodeURIComponent(fragment)}` : prefix
}

function escapeLabel(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("]", "\\]")
}

async function listFiles(root) {
  const files = []

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not supported in export inputs: ${absolute}`)
      }
      if (entry.isDirectory()) {
        await visit(absolute)
      } else if (entry.isFile()) {
        files.push(absolute)
      }
    }
  }

  await visit(root)
  return files
}

function splitFrontmatter(content, sourcePath) {
  const opening = content.match(/^---(?:\r?\n)/)
  if (!opening) {
    return {
      hasFrontmatter: false,
      opening: "",
      frontmatter: "",
      closing: "",
      body: content,
      newline: content.includes("\r\n") ? "\r\n" : "\n",
    }
  }

  const newline = opening[0].includes("\r\n") ? "\r\n" : "\n"
  const closingPattern = new RegExp(`^---[ \\t]*(?:${newline}|$)`, "m")
  const remainder = content.slice(opening[0].length)
  const closing = closingPattern.exec(remainder)
  if (!closing) {
    throw new Error(`Unclosed frontmatter: ${sourcePath}`)
  }

  const frontmatterEnd = opening[0].length + closing.index
  const bodyStart = frontmatterEnd + closing[0].length
  return {
    hasFrontmatter: true,
    opening: opening[0],
    frontmatter: content.slice(opening[0].length, frontmatterEnd),
    closing: closing[0],
    body: content.slice(bodyStart),
    newline,
  }
}

function hasTopLevelKey(frontmatter, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^(?:${escaped}|["']${escaped}["'])[ \\t]*:`, "m").test(frontmatter)
}

function documentTitle(body, relativePath) {
  const heading = body.match(/^#\s+(.+?)\s*$/m)
  return heading ? heading[1].trim() : path.basename(relativePath, path.extname(relativePath))
}

function documentDescription(body, title) {
  const lines = body.replace(/^#\s+.*(?:\r?\n|$)/m, "").split(/\r?\n/)
  let paragraph = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (paragraph.length > 0) break
      continue
    }
    if (/^(?:#{1,6}\s|[-*+]\s|\d+\.\s|>|```|~~~|\|)/.test(trimmed)) {
      if (paragraph.length > 0) break
      continue
    }
    paragraph.push(trimmed)
  }

  return paragraph.join(" ") || `${title}에 관한 지식 문서`
}

function inferredType(relativePath) {
  const [directory] = normalizePath(relativePath).split("/")
  if (WIKI_TYPES.has(directory)) return WIKI_TYPES.get(directory)
  return "document"
}

function isKnowledgePage(relativePath) {
  const [directory] = normalizePath(relativePath).split("/")
  return WIKI_TYPES.has(directory) && path.extname(relativePath).toLowerCase() === ".md"
}

function withRequiredMetadata(content, relativePath, generatedAt) {
  const parsed = splitFrontmatter(content, relativePath)
  const title = documentTitle(parsed.body, relativePath)
  const additions = []

  if (!hasTopLevelKey(parsed.frontmatter, "type")) {
    additions.push(`type: ${JSON.stringify(inferredType(relativePath))}`)
  }
  if (!hasTopLevelKey(parsed.frontmatter, "title")) {
    additions.push(`title: ${JSON.stringify(title)}`)
  }
  if (!hasTopLevelKey(parsed.frontmatter, "description")) {
    additions.push(`description: ${JSON.stringify(documentDescription(parsed.body, title))}`)
  }
  if (!hasTopLevelKey(parsed.frontmatter, "generated")) {
    additions.push(`generated: ${JSON.stringify({ by: TOOL_NAME, at: generatedAt })}`)
  }

  if (!parsed.hasFrontmatter) {
    return `---${parsed.newline}${additions.join(parsed.newline)}${parsed.newline}---${parsed.newline}${parsed.body}`
  }

  if (additions.length === 0) return content
  const separator = parsed.frontmatter.endsWith(parsed.newline) ? "" : parsed.newline
  return `${parsed.opening}${parsed.frontmatter}${separator}${additions.join(parsed.newline)}${parsed.newline}${parsed.closing}${parsed.body}`
}

function parseWikilink(value) {
  const separator = value.indexOf("|")
  const targetWithFragment = separator === -1 ? value : value.slice(0, separator)
  const label = separator === -1 ? null : value.slice(separator + 1)
  const fragmentSeparator = targetWithFragment.indexOf("#")
  return {
    target: (fragmentSeparator === -1 ? targetWithFragment : targetWithFragment.slice(0, fragmentSeparator)).trim(),
    fragment: fragmentSeparator === -1 ? "" : targetWithFragment.slice(fragmentSeparator + 1).trim(),
    label: label?.trim() || null,
  }
}

function buildSlugIndex(wikiFiles, wikiRoot) {
  const slugs = new Map()
  for (const file of wikiFiles.filter((candidate) => path.extname(candidate).toLowerCase() === ".md")) {
    const slug = path.basename(file, path.extname(file))
    const existing = slugs.get(slug) ?? []
    existing.push(path.relative(wikiRoot, file))
    slugs.set(slug, existing)
  }
  return slugs
}

function isEscaped(content, index) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}

function lineIndent(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1
  const indent = content.slice(lineStart, index)
  return /^[ ]{0,3}$/.test(indent)
}

function backtickRunLength(content, index) {
  let end = index
  while (content[end] === "`") end += 1
  return end - index
}

function fenceAt(content, index) {
  const marker = content[index]
  if ((marker !== "`" && marker !== "~") || !lineIndent(content, index)) return null

  let end = index
  while (content[end] === marker) end += 1
  return end - index >= 3 ? { marker, length: end - index } : null
}

function closingFenceAt(content, index, fence) {
  if (content[index] !== fence.marker || !lineIndent(content, index)) return false

  let end = index
  while (content[end] === fence.marker) end += 1
  if (end - index < fence.length) return false

  const lineEnd = content.indexOf("\n", end)
  return /^[ \t\r]*$/.test(content.slice(end, lineEnd === -1 ? content.length : lineEnd))
}

function markdownCodeRanges(content) {
  const ranges = []
  let inlineStart = null
  let inlineLength = 0
  let fence = null

  for (let index = 0; index < content.length; index += 1) {
    if (fence) {
      if (closingFenceAt(content, index, fence)) {
        const lineEnd = content.indexOf("\n", index)
        ranges.push([fence.start, lineEnd === -1 ? content.length : lineEnd + 1])
        while (content[index + 1] === fence.marker) index += 1
        fence = null
      }
      continue
    }

    if (inlineStart !== null) {
      if (content[index] === "`" && backtickRunLength(content, index) === inlineLength) {
        ranges.push([inlineStart, index + inlineLength])
        inlineStart = null
        index += inlineLength - 1
        inlineLength = 0
      }
      continue
    }

    const openingFence = fenceAt(content, index)
    if (openingFence) {
      fence = { ...openingFence, start: index }
      continue
    }

    if (content[index] === "`" && !isEscaped(content, index)) {
      inlineStart = index
      inlineLength = backtickRunLength(content, index)
      index += inlineLength - 1
    }
  }

  if (fence) ranges.push([fence.start, content.length])
  return ranges
}

function isInRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end)
}

async function convertWikilinks(content, sourceFile, wikiRoot, rawRoot, slugIndex) {
  const codeRanges = markdownCodeRanges(content)
  const matches = [...content.matchAll(/\[\[([^\]\n]+)\]\]/g)].filter((match) => !isInRanges(match.index, codeRanges))
  if (matches.length === 0) return content

  let converted = ""
  let cursor = 0
  for (const match of matches) {
    const parsed = parseWikilink(match[1])
    let targetFile
    let defaultLabel

    if (parsed.target.includes("raw/")) {
      targetFile = path.resolve(path.dirname(sourceFile), parsed.target)
      const relativeToRaw = path.relative(rawRoot, targetFile)
      if (relativeToRaw.startsWith("..") || path.isAbsolute(relativeToRaw)) {
        throw new Error(`Raw link escapes public raw/: ${sourceFile}: ${match[0]}`)
      }
      let stat
      try {
        stat = await fs.lstat(targetFile)
      } catch (error) {
        if (error.code === "ENOENT") {
          throw new Error(`Unresolved raw link: ${sourceFile}: ${match[0]}`)
        }
        throw error
      }
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`Raw link does not target a regular file: ${sourceFile}: ${match[0]}`)
      }
      defaultLabel = path.basename(parsed.target, path.extname(parsed.target))
    } else {
      if (parsed.target.includes("/") || parsed.target.includes("\\")) {
        throw new Error(`Unresolved wiki link (expected bare slug): ${sourceFile}: ${match[0]}`)
      }
      const candidates = slugIndex.get(parsed.target) ?? []
      if (candidates.length !== 1) {
        const reason = candidates.length === 0 ? "Unresolved" : "Ambiguous"
        throw new Error(`${reason} wiki link: ${sourceFile}: ${match[0]}`)
      }
      targetFile = path.join(wikiRoot, candidates[0])
      defaultLabel = parsed.target
    }

    const outputSource = path.join("wiki", outputRelativePath(path.relative(wikiRoot, sourceFile)))
    const outputTarget = targetFile.startsWith(rawRoot + path.sep)
      ? path.join("raw", path.relative(rawRoot, targetFile))
      : path.join("wiki", outputRelativePath(path.relative(wikiRoot, targetFile)))
    const relativeTarget = path.relative(path.dirname(outputSource), outputTarget)
    const markdown = `[${escapeLabel(parsed.label ?? defaultLabel)}](${markdownTarget(relativeTarget, parsed.fragment)})`

    converted += content.slice(cursor, match.index) + markdown
    cursor = match.index + match[0].length
  }

  return converted + content.slice(cursor)
}

function outputRelativePath(relativePath) {
  return normalizePath(relativePath) === "INDEX.md" ? "index.md" : relativePath
}

async function copyRawFiles(rawFiles, rawRoot, outputRoot) {
  for (const source of rawFiles) {
    const destination = path.join(outputRoot, "raw", path.relative(rawRoot, source))
    await fs.mkdir(path.dirname(destination), { recursive: true })
    if (path.extname(source).toLowerCase() !== ".md") {
      await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL)
      continue
    }

    const original = await fs.readFile(source, "utf8")
    const enriched = withRawReferenceMetadata(original, path.relative(rawRoot, source))
    await fs.writeFile(destination, enriched, { encoding: "utf8", flag: "wx" })
  }
}

function withRawReferenceMetadata(content, relativePath) {
  const parsed = splitFrontmatter(content, relativePath)
  if (hasTopLevelKey(parsed.frontmatter, "type")) return content

  const addition = 'type: "Reference"'
  if (!parsed.hasFrontmatter) {
    return `---${parsed.newline}${addition}${parsed.newline}---${parsed.newline}${parsed.body}`
  }

  const separator = parsed.frontmatter.endsWith(parsed.newline) ? "" : parsed.newline
  return `${parsed.opening}${parsed.frontmatter}${separator}${addition}${parsed.newline}${parsed.closing}${parsed.body}`
}

function rootIndex() {
  return [
    "---",
    'okf_version: "0.2"',
    "---",
    "",
    "# fos-brain public knowledge",
    "",
    "- [Wiki index](./wiki/index.md)",
    "- [Raw sources](./raw/)",
    "",
  ].join("\n")
}

async function exportOkf(repositoryRoot, outputPath) {
  const root = path.resolve(repositoryRoot)
  const output = path.resolve(outputPath)
  const wikiRoot = path.join(root, "wiki")
  const rawRoot = path.join(root, "raw")

  try {
    await fs.lstat(output)
    throw new Error(`Output path already exists: ${output}`)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }

  for (const required of [wikiRoot, rawRoot]) {
    const stat = await fs.lstat(required)
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`Export input must be a regular directory: ${required}`)
    }
  }

  const [wikiFiles, rawFiles] = await Promise.all([listFiles(wikiRoot), listFiles(rawRoot)])
  const slugIndex = buildSlugIndex(wikiFiles, wikiRoot)
  const generatedAt = new Date().toISOString()
  const parent = path.dirname(output)
  await fs.mkdir(parent, { recursive: true })
  const temporary = await fs.mkdtemp(path.join(parent, `.${path.basename(output)}.tmp-`))

  try {
    await copyRawFiles(rawFiles, rawRoot, temporary)
    for (const source of wikiFiles) {
      const relative = path.relative(wikiRoot, source)
      const destination = path.join(temporary, "wiki", outputRelativePath(relative))
      await fs.mkdir(path.dirname(destination), { recursive: true })

      if (path.extname(source).toLowerCase() !== ".md") {
        await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL)
        continue
      }

      const original = await fs.readFile(source, "utf8")
      const parsed = splitFrontmatter(original, relative)
      const linkedBody = await convertWikilinks(parsed.body, source, wikiRoot, rawRoot, slugIndex)
      const linked = parsed.hasFrontmatter
        ? `${parsed.opening}${parsed.frontmatter}${parsed.closing}${linkedBody}`
        : linkedBody
      const enriched = isKnowledgePage(relative) ? withRequiredMetadata(linked, relative, generatedAt) : linked
      await fs.writeFile(destination, enriched, { encoding: "utf8", flag: "wx" })
    }

    await fs.writeFile(path.join(temporary, "index.md"), rootIndex(), { encoding: "utf8", flag: "wx" })
    await fs.rename(temporary, output)
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const [, , repositoryRoot, outputPath, ...extra] = process.argv
  if (!repositoryRoot || !outputPath || extra.length > 0) {
    throw new Error(usage())
  }
  await exportOkf(repositoryRoot, outputPath)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`okf-export: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { exportOkf }
