const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const test = require("node:test")

const pluginRoot = path.resolve(__dirname, "..")
const generator = path.join(pluginRoot, "skills", "brain-add", "scripts", "generate_preview.py")

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brain-add-preview-"))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

test("renders brain-add pages with the shared Memory Atlas contract", async (t) => {
  const directory = await temporaryDirectory(t)
  const known = path.join(directory, "known")
  const newPage = path.join(directory, "rag-retrieval.md")
  const updatePage = path.join(directory, "rag-strategy.md")
  const output = path.join(directory, "preview.html")
  await fs.mkdir(known)
  await fs.writeFile(path.join(known, "existing.md"), "# Existing\n")
  await fs.writeFile(
    newPage,
    "---\ntype: concept\ncreated: 2026-08-26\nupdated: 2026-08-26\n---\n\n# RAG 검색\n\n[[existing]]과 [[missing]]을 연결한다.\n",
  )
  await fs.writeFile(
    updatePage,
    "---\ntype: topic\ncreated: 2026-08-01\nupdated: 2026-08-26\n---\n\n# RAG 전략\n",
  )

  const generated = spawnSync(
    "python3",
    [
      generator,
      "--ns",
      "public",
      "--title",
      "RAG 트리 확장",
      "--summary",
      "검색 지식을 보강합니다.",
      "--new",
      newPage,
      "--update",
      updatePage,
      "--known-from",
      known,
      "--out",
      output,
    ],
    { encoding: "utf8" },
  )
  assert.equal(generated.status, 0, generated.stderr)

  const html = await fs.readFile(output, "utf8")
  assert.match(html, /data-preview-contract="memory-atlas-doc-v1"/)
  assert.match(html, /FOS \/ MEMORY · BRAIN ADD/)
  assert.match(html, /--atlas-void: #020608/)
  assert.match(html, /Gowun Batang/)
  assert.match(html, /IBM Plex Sans KR/)
  assert.match(html, /RAG 트리 확장/)
  assert.match(html, /public · 신규 · concept/)
  assert.match(html, /public · 보강 · topic/)
  assert.match(html, /wikilink--missing/)
  assert.doesNotMatch(html, /#f4f1ea/)
  assert.doesNotMatch(html, /github-markdown-css/)
})

test("rejects a script-closing sequence before template injection", async (t) => {
  const directory = await temporaryDirectory(t)
  const page = path.join(directory, "unsafe.md")
  const output = path.join(directory, "preview.html")
  await fs.writeFile(page, "# Unsafe\n\n</script>\n")

  const generated = spawnSync(
    "python3",
    [generator, "--new", page, "--out", output],
    { encoding: "utf8" },
  )
  assert.equal(generated.status, 1)
  assert.match(generated.stderr, /<\/script>/)
  await assert.rejects(fs.access(output), { code: "ENOENT" })
})
