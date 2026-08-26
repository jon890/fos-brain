const assert = require("node:assert/strict")
const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const test = require("node:test")

const pluginRoot = path.resolve(__dirname, "..")
const skillRoot = path.join(pluginRoot, "skills", "brain-curate")
const generator = path.join(skillRoot, "scripts", "generate_preview.py")
const previewOpener = path.join(skillRoot, "scripts", "show_preview.sh")

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brain-curate-preview-"))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

test("renders the current Memory Atlas document contract", async (t) => {
  const directory = await temporaryDirectory(t)
  const input = path.join(directory, "preview.json")
  const output = path.join(directory, "preview.html")
  await fs.writeFile(
    input,
    JSON.stringify({
      title: "지식 최신화",
      stats: { 신규: { n: 1, kind: "new" } },
      candidates: [
        {
          candidate: "긴 제목과 <표찰>도 안전하게 표시하는 후보",
          decision: "admit",
          value_axes: ["taste"],
          destination: "public",
          future_question: "모바일에서도 후보의 의미를 한 화면에서 이해할 수 있는가?",
          evidence: ["session://preview"],
          reason: "현재 지식 화면과 같은 정보 위계를 사용한다.",
        },
      ],
      pages: [
        {
          frontmatter: "type: concept · status: stable",
          markdown: "# 문서 제목\n\n## 표\n\n| 열 | 값 |\n| --- | --- |\n| 긴 값 | `code` |",
        },
      ],
    }),
  )

  const generated = spawnSync("python3", [generator, "--data", input, "--out", output], {
    encoding: "utf8",
  })
  assert.equal(generated.status, 0, generated.stderr)

  const html = await fs.readFile(output, "utf8")
  assert.match(html, /data-preview-contract="memory-atlas-doc-v1"/)
  assert.match(html, /Gowun Batang/)
  assert.match(html, /IBM Plex Sans KR/)
  assert.match(html, /--atlas-void: #020608/)
  assert.match(html, /현재 Memory Atlas 문서 화면/)
  assert.match(html, /3D 상호작용은 포함하지 않습니다/)
  assert.match(html, /@media \(max-width: 800px\)/)
  assert.match(html, /overflow-x: auto/)
  assert.match(html, /escapeHtml\(candidate\.candidate\)/)
  assert.doesNotMatch(html, /#faf8f8/)
  assert.doesNotMatch(html, /등록되면 이 모습으로 컴파일됩니다/)
})

test("rejects a script-closing sequence before template injection", async (t) => {
  const directory = await temporaryDirectory(t)
  const input = path.join(directory, "unsafe.json")
  const output = path.join(directory, "preview.html")
  await fs.writeFile(input, JSON.stringify({ title: "</script>", candidates: [] }))

  const generated = spawnSync("python3", [generator, "--data", input, "--out", output], {
    encoding: "utf8",
  })
  assert.equal(generated.status, 1)
  assert.match(generated.stderr, /데이터에 <\/script> 문자열/)
  await assert.rejects(fs.access(output), { code: "ENOENT" })
})

test("delegates opening to the installed content-preview helper", async (t) => {
  const directory = await temporaryDirectory(t)
  const preview = path.join(directory, "preview.html")
  const delegate = path.join(directory, "show-preview.sh")
  const capture = path.join(directory, "opened.txt")
  await fs.writeFile(preview, "<!doctype html><title>preview</title>")
  await fs.writeFile(delegate, '#!/bin/sh\nprintf "%s" "$1" > "$CAPTURE"\n')
  await fs.chmod(delegate, 0o700)

  const opened = spawnSync("bash", [previewOpener, preview], {
    encoding: "utf8",
    env: { ...process.env, CONTENT_PREVIEW_SHOW: delegate, CAPTURE: capture },
  })
  assert.equal(opened.status, 0, opened.stderr)
  assert.equal(await fs.readFile(capture, "utf8"), preview)
})
