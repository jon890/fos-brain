const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")

const { exportOkf } = require("../scripts/okf-export.cjs")

async function write(root, relativePath, content) {
  const destination = path.join(root, relativePath)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, content)
}

function frontmatter(content, relativePath) {
  assert.match(content, /^---(?:\r?\n)/, `${relativePath} must start with frontmatter`)
  const closing = content.slice(4).match(/^---[ \t]*(?:\r?\n|$)/m)
  assert.ok(closing, `${relativePath} must have closed frontmatter`)
  return content.slice(4, 4 + closing.index)
}

async function assertAllNonReservedMarkdownHasType(output) {
  const reserved = new Set(["index.md", "wiki/index.md", "wiki/log.md"])
  const exportedFiles = await fs.readdir(output, { recursive: true })
  for (const entry of exportedFiles.filter((candidate) => path.extname(candidate) === ".md")) {
    if (reserved.has(entry)) continue
    const content = await fs.readFile(path.join(output, entry), "utf8")
    assert.match(frontmatter(content, entry), /^type:[ \t]*\S/m, `${entry} must have a nonempty type`)
  }
}

async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "fos-brain-okf-"))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const repository = path.join(temporary, "repository")
  const output = path.join(temporary, "export")

  await write(repository, "raw/notes/source one.md", "public source with [[alpha]] literal\n")
  await write(
    repository,
    "raw/notes/existing-reference.md",
    "---\nstatus: draft\n---\n\nExisting reference body.\n",
  )
  await write(repository, "raw/assets/blob.bin", Buffer.from([0, 1, 2, 255]))
  await write(repository, "private/raw/notes/secret.md", "PRIVATE-SENTINEL\n")
  await write(repository, "private/wiki/concepts/secret.md", "# Private sentinel\n\nPRIVATE-SENTINEL\n")
  await write(repository, "wiki/INDEX.md", "# Wiki index\n\nStart with [[alpha]].\n")
  await write(repository, "wiki/log.md", "# Log\n\n- Linked [[alpha]] without knowledge metadata.\n")
  await write(
    repository,
    "wiki/concepts/alpha.md",
    [
      "---",
      "created: 2026-08-18",
      "updated: 2026-08-18",
      "sources:",
      "  - id: local-source",
      '    resource: "raw/notes/source one.md"',
      "custom:",
      "  nested:",
      "    - keep: exactly",
      '  wikilink: "[[beta]]"',
      "---",
      "",
      "# Alpha title",
      "",
      "Alpha description.",
      "",
      "See [[beta|Beta page]] and [[../../raw/notes/source one.md|source]].",
      "",
    ].join("\n"),
  )
  await write(
    repository,
    "wiki/topics/beta.md",
    "---\ntype: topic\ntitle: Existing title\ndescription: Existing description\ngenerated:\n  by: existing-tool\n  at: 2026-08-01\n---\n\n# Beta\n\nBack to [[alpha#details]].\n",
  )

  return { repository, output }
}

test("exports public wiki and raw with required metadata and Markdown links", async (t) => {
  const { repository, output } = await fixture(t)
  await exportOkf(repository, output)

  const alpha = await fs.readFile(path.join(output, "wiki/concepts/alpha.md"), "utf8")
  const beta = await fs.readFile(path.join(output, "wiki/topics/beta.md"), "utf8")
  const index = await fs.readFile(path.join(output, "index.md"), "utf8")
  const wikiIndex = await fs.readFile(path.join(output, "wiki/index.md"), "utf8")
  const log = await fs.readFile(path.join(output, "wiki/log.md"), "utf8")

  assert.match(alpha, /^type: "concept"$/m)
  assert.match(alpha, /^title: "Alpha title"$/m)
  assert.match(alpha, /^description: "Alpha description\."$/m)
  assert.match(alpha, /^generated: \{"by":"fos-brain\/okf-export","at":"[^\"]+"\}$/m)
  assert.ok(
    alpha.includes('sources:\n  - id: local-source\n    resource: "raw/notes/source one.md"\ncustom:\n  nested:\n    - keep: exactly\n  wikilink: "[[beta]]"'),
    "existing nested frontmatter must remain byte-for-byte intact",
  )
  assert.match(alpha, /\[Beta page\]\(\.\.\/topics\/beta\.md\)/)
  assert.match(alpha, /\[source\]\(\.\.\/\.\.\/raw\/notes\/source%20one\.md\)/)
  assert.match(beta, /\[alpha\]\(\.\.\/concepts\/alpha\.md#details\)/)
  assert.match(beta, /^generated:\n  by: existing-tool\n  at: 2026-08-01$/m)
  assert.match(index, /^okf_version: "0\.2"$/m)
  assert.doesNotMatch(index, /^type:/m)
  assert.doesNotMatch(index, /^title:/m)
  assert.doesNotMatch(index, /^description:/m)
  assert.doesNotMatch(index, /^generated:/m)
  assert.match(index, /\[Wiki index\]\(\.\/wiki\/index\.md\)/)
  assert.match(wikiIndex, /^# Wiki index$/m)
  assert.match(wikiIndex, /\[alpha\]\(\.\/concepts\/alpha\.md\)/)
  assert.doesNotMatch(wikiIndex, /^type:/m)
  assert.doesNotMatch(wikiIndex, /^generated:/m)
  assert.match(log, /^# Log$/m)
  assert.match(log, /\[alpha\]\(\.\/concepts\/alpha\.md\)/)
  assert.doesNotMatch(log, /^type:/m)
  assert.doesNotMatch(log, /^generated:/m)

  const rawSource = await fs.readFile(path.join(output, "raw/notes/source one.md"), "utf8")
  const rawExisting = await fs.readFile(path.join(output, "raw/notes/existing-reference.md"), "utf8")
  const rawBlob = await fs.readFile(path.join(output, "raw/assets/blob.bin"))

  assert.match(rawSource, /^---\ntype: "Reference"\n---\npublic source with \[\[alpha\]\] literal\n$/)
  assert.match(rawExisting, /^---\nstatus: draft\ntype: "Reference"\n---\n\nExisting reference body\.\n$/)
  assert.deepEqual(rawBlob, Buffer.from([0, 1, 2, 255]))
  await assertAllNonReservedMarkdownHasType(output)

  const exportedFiles = await fs.readdir(output, { recursive: true })
  assert.equal(exportedFiles.some((entry) => entry.includes("private")), false)
  const exportedText = await Promise.all(
    exportedFiles
      .filter((entry) => path.extname(entry) === ".md")
      .map((entry) => fs.readFile(path.join(output, entry), "utf8")),
  )
  assert.equal(exportedText.join("\n").includes("PRIVATE-SENTINEL"), false)
})

test("refuses to overwrite an existing output", async (t) => {
  const { repository, output } = await fixture(t)
  await fs.mkdir(output)
  await write(output, "keep.txt", "do not overwrite\n")

  await assert.rejects(exportOkf(repository, output), /Output path already exists/)
  assert.equal(await fs.readFile(path.join(output, "keep.txt"), "utf8"), "do not overwrite\n")
})

test("removes temporary output when a link cannot be resolved", async (t) => {
  const { repository, output } = await fixture(t)
  await write(repository, "wiki/concepts/broken.md", "# Broken\n\nSee [[missing-page]].\n")

  await assert.rejects(exportOkf(repository, output), /Unresolved wiki link/)
  await assert.rejects(fs.access(output), { code: "ENOENT" })
  const parentEntries = await fs.readdir(path.dirname(output))
  assert.equal(parentEntries.some((entry) => entry.startsWith(".export.tmp-")), false)
})

test("preserves wikilink examples in Markdown code while converting prose links", async (t) => {
  const { repository, output } = await fixture(t)
  await write(
    repository,
    "wiki/concepts/code-examples.md",
    [
      "# Code examples",
      "",
      "Prose [[alpha]] should convert.",
      "",
      "Inline `[[alpha]]` and ``[[beta|literal beta]]`` stay literal.",
      "",
      "Escaped \\` marker leaves [[beta]] in prose.",
      "",
      "```markdown",
      "[[alpha]]",
      "```",
      "",
      "~~~markdown",
      "[[beta|literal beta]]",
      "~~~",
      "",
      "Trailing prose [[beta]].",
      "",
    ].join("\n"),
  )

  await exportOkf(repository, output)

  const exported = await fs.readFile(path.join(output, "wiki/concepts/code-examples.md"), "utf8")
  assert.match(exported, /Prose \[alpha\]\(\.\/alpha\.md\) should convert\./)
  assert.match(exported, /Escaped \\` marker leaves \[beta\]\(\.\.\/topics\/beta\.md\) in prose\./)
  assert.match(exported, /Trailing prose \[beta\]\(\.\.\/topics\/beta\.md\)\./)
  assert.ok(exported.includes("Inline `[[alpha]]` and ``[[beta|literal beta]]`` stay literal."))
  assert.ok(exported.includes("```markdown\n[[alpha]]\n```"))
  assert.ok(exported.includes("~~~markdown\n[[beta|literal beta]]\n~~~"))
})
