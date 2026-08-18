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

async function fixture(t) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "fos-brain-okf-"))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const repository = path.join(temporary, "repository")
  const output = path.join(temporary, "export")

  await write(repository, "raw/notes/source one.md", "public source\n")
  await write(repository, "private/raw/notes/secret.md", "PRIVATE-SENTINEL\n")
  await write(repository, "private/wiki/concepts/secret.md", "# Private sentinel\n\nPRIVATE-SENTINEL\n")
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

  assert.equal(await fs.readFile(path.join(output, "raw/notes/source one.md"), "utf8"), "public source\n")
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
