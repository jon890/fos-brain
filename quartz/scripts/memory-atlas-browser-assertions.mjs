const browserHelpers = `
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const frameWindow = (id) => {
  const frame = document.getElementById(id)
  if (!frame || !frame.contentWindow) throw new Error(\`missing frame: \${id}\`)
  return frame.contentWindow
}
const byTestId = (doc, id) => {
  const element = doc.querySelector(\`[data-testid="\${id}"]\`)
  if (!element) throw new Error(\`missing test id: \${id}\`)
  return element
}
const waitFor = async (predicate, label, timeout = 12000) => {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (predicate()) return
    await sleep(80)
  }
  throw new Error(\`timeout waiting for \${label}\`)
}
const noHorizontalOverflow = (doc) => {
  if (doc.body.scrollWidth > doc.documentElement.clientWidth + 2) {
    throw new Error(\`document overflow: \${doc.body.scrollWidth} > \${doc.documentElement.clientWidth}\`)
  }
  const visibleBoxOffenders = [...doc.querySelectorAll(".memory-atlas__topbar > *, .memory-atlas__context > *, .memory-atlas__detail > *")]
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= doc.documentElement.clientHeight) return false
      return rect.left < -2 || rect.right > doc.documentElement.clientWidth + 2
    })
    .map((element) => element.className || element.tagName)
  if (visibleBoxOffenders.length) throw new Error(\`visible box overflow: \${visibleBoxOffenders.join(", ")}\`)
  const nodeOffenders = [...doc.querySelectorAll(".memory-atlas-2d__nodes button")]
    .filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < -2 || rect.right > doc.documentElement.clientWidth + 2
    })
    .map((element) => element.textContent.trim())
  if (nodeOffenders.length) throw new Error(\`node box overflow: \${nodeOffenders.join(", ")}\`)
}
const dispatchInput = (element, value) => {
  element.value = value
  element.dispatchEvent(new Event("input", { bubbles: true }))
}
const frameDocument = (id) => frameWindow(id).document
const key = (target, value, options = {}) => {
  const init = { key: value, code: value, bubbles: true, cancelable: true, ...options }
  const down = target.dispatchEvent(new KeyboardEvent("keydown", init))
  target.dispatchEvent(new KeyboardEvent("keyup", init))
  return down
}
const activateWithSyntheticKeyboard = (element, keyName) => {
  element.focus()
  const allowedDefault = key(element, keyName, { code: keyName === " " ? "Space" : keyName })
  if (allowedDefault && (element.tagName === "BUTTON" || element.tagName === "A")) element.click()
}
const activeNodeButtons = (doc) => [...doc.querySelectorAll(".memory-atlas-2d__nodes button[data-selected='true'], .memory-atlas-2d__nodes button[data-related='true']")]
const assertNoPrivateAtlasLeak = (doc) => {
  const html = doc.body.innerHTML
  for (const token of ["_private/", "Private Shadow Node", "private-secret-rag"]) {
    if (html.includes(token)) throw new Error(\`private atlas value leaked: \${token}\`)
  }
  const leakedLink = [...doc.querySelectorAll(".memory-atlas-2d__link")].find((link) =>
    [link.dataset.source, link.dataset.target].some((value) => value?.startsWith("_private/")),
  )
  if (leakedLink) throw new Error("private semantic edge reached graph DOM")
}
`

function wrap(body) {
  return `(async () => {
${browserHelpers}
${body}
})()`
}

export const assertions = {
  waitHarnessReady: `Array.from(document.querySelectorAll("iframe")).every((frame) => frame.contentDocument?.querySelector('[data-testid="memory-atlas"]')?.dataset.runtimeState === "ready")`,

  viewportBasics: wrap(`
const results = {}
for (const id of ["desktop-frame", "mobile-frame"]) {
  const win = frameWindow(id)
  const doc = win.document
  await waitFor(() => byTestId(doc, "memory-atlas").dataset.runtimeState === "ready", \`\${id} atlas ready\`)
  const root = byTestId(doc, "memory-atlas")
  const canvas = byTestId(doc, "memory-atlas-canvas")
  if (root.dataset.runtimeState !== "ready") throw new Error(\`\${id} runtime not ready\`)
  if (canvas.dataset.runtimeMode !== "2d") throw new Error(\`\${id} did not start in 2D\`)
  for (const text of ["커리어", "건강", "AI", "RAG"]) {
    if (!doc.body.textContent.includes(text)) throw new Error(\`\${id} missing \${text}\`)
  }
  if (!doc.body.textContent.includes("발견한 영역")) throw new Error(\`\${id} missing automatic entrypoints\`)
  if (!doc.body.textContent.includes("1-hop")) throw new Error(\`\${id} missing depth legend\`)
  if (!doc.body.textContent.includes("wiki 링크") || !doc.body.textContent.includes("의미 유사도")) throw new Error(\`\${id} missing relation type legend\`)
  if (!canvas.querySelector(".memory-atlas-2d__svg")) throw new Error(\`\${id} missing 2D svg\`)
  const buttons = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")]
  if (!buttons.length) throw new Error(\`\${id} missing node buttons\`)
  if (buttons.some((button) => !button.textContent.trim())) throw new Error(\`\${id} has empty node label\`)
  noHorizontalOverflow(doc)
  results[id] = { nodes: buttons.length, links: canvas.querySelectorAll(".memory-atlas-2d__link").length }
}
return results
`),

  localRelationFlow: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const root = byTestId(doc, "memory-atlas")
const canvas = byTestId(doc, "memory-atlas-canvas")
const globalNodeCount = canvas.querySelectorAll(".memory-atlas-2d__nodes button").length
const ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
if (!ragEntry || ragEntry.disabled) throw new Error("RAG entrypoint unavailable")
const ragSlug = ragEntry.dataset.slug
ragEntry.click()
await waitFor(() => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${ragSlug}"][data-selected="true"]\`), "RAG centered")
let buttons = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")]
const rag = buttons.find((button) => button.dataset.slug === ragSlug)
const graphRag = buttons.find((button) => button.textContent.trim().includes("GraphRAG"))
if (!rag || !graphRag) throw new Error("missing RAG or GraphRAG node")
if (rag.dataset.selected !== "true" || rag.dataset.depth !== "0") throw new Error("RAG is not selected depth 0")
if (graphRag.dataset.depth !== "1") throw new Error("GraphRAG is not 1-hop from RAG")
const background = buttons.find((button) => button.dataset.related === "false")
if (buttons.length !== globalNodeCount) throw new Error("nodes outside the selected relation were removed")
if (background && !(Number(graphRag.style.opacity) > Number(background.style.opacity))) throw new Error("1-hop node is not brighter than background")
graphRag.click()
await waitFor(() => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${graphRag.dataset.slug}"][data-selected="true"]\`), "GraphRAG centered")
buttons = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")]
const centered = buttons.find((button) => button.textContent.trim().includes("GraphRAG"))
if (centered?.dataset.selected !== "true" || centered?.dataset.depth !== "0") throw new Error("GraphRAG did not become center")
centered.focus()
centered.click()
await waitFor(() => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${centered.dataset.slug}"]\`) === doc.activeElement, "graph node focus restored after rerender")
const labels = byTestId(doc, "memory-atlas-labels")
labels.checked = false
labels.dispatchEvent(new Event("change", { bubbles: true }))
await waitFor(() => [...canvas.querySelectorAll(".memory-atlas-2d__label")].every((label) => Number(label.style.opacity) === 0), "labels hidden")
if ([...canvas.querySelectorAll(".memory-atlas-2d__nodes button")].some((button) => Number(button.style.opacity) === 0)) throw new Error("label toggle hid graph nodes")
labels.checked = true
labels.dispatchEvent(new Event("change", { bubbles: true }))
byTestId(doc, "memory-atlas-clear-selection").click()
await waitFor(() => byTestId(doc, "memory-atlas-context-title").textContent.trim() === "전체 지도", "global map restored")
if (root.classList.contains("memory-atlas--detail-open")) throw new Error("detail remained open after clearing selection")
return { centered: "GraphRAG", restored: true }
`),

  keyboardMarkupContract: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const canvas = byTestId(doc, "memory-atlas-canvas")
byTestId(doc, "memory-atlas-clear-selection").click()
await waitFor(() => byTestId(doc, "memory-atlas-context-title").textContent.trim() === "전체 지도", "global map before markup check")
const ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
if (!ragEntry || ragEntry.disabled) throw new Error("RAG entrypoint unavailable")
if (ragEntry.tagName !== "BUTTON" || ragEntry.tabIndex < 0) throw new Error("RAG entrypoint is not a native keyboard-focusable button")
const graphButtons = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")]
if (!graphButtons.length) throw new Error("graph node buttons are missing")
if (graphButtons.some((button) => button.tabIndex < 0 || !["true", "false"].includes(button.getAttribute("aria-pressed")))) throw new Error("graph node button accessibility markup is invalid")
ragEntry.click()
await waitFor(() => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${ragEntry.dataset.slug}"][aria-pressed="true"]\`), "selected node aria state")
return { nativeButtons: true, tabOrder: true, pressedState: true }
`),

  syntheticKeyboardNavigation: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const canvas = byTestId(doc, "memory-atlas-canvas")
let ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
if (!ragEntry || ragEntry.disabled) throw new Error("RAG entrypoint unavailable for synthetic keyboard check")
activateWithSyntheticKeyboard(ragEntry, "Enter")
await waitFor(() => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${ragEntry.dataset.slug}"][data-selected="true"]\`), "synthetic Enter selects RAG")
key(doc, "Escape")
await waitFor(() => byTestId(doc, "memory-atlas-context-title").textContent.trim() === "전체 지도", "Escape clears synthetic Enter selection")
ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
activateWithSyntheticKeyboard(ragEntry, " ")
await waitFor(() => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${ragEntry.dataset.slug}"][data-selected="true"]\`), "synthetic Space selects RAG")
return { syntheticEnter: true, syntheticSpace: true, escape: true }
`),

  modeAndLazyLoad: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const canvas = byTestId(doc, "memory-atlas-canvas")
const urlsBefore = win.performance.getEntriesByType("resource").map((entry) => entry.name)
if (urlsBefore.some((url) => url.includes("memory-atlas-3d.js"))) throw new Error("3D bundle loaded before selecting 3D")
const search = byTestId(doc, "memory-atlas-search")
dispatchInput(search, "RAG")
await waitFor(() => doc.querySelector('[data-testid="memory-atlas-results"] button'), "filtered result")
const result = doc.querySelector('[data-testid="memory-atlas-results"] button')
result.click()
await waitFor(() => byTestId(doc, "memory-atlas").classList.contains("memory-atlas--detail-open"), "detail after filtered select")
const selectedTitle = byTestId(doc, "memory-atlas-detail-title").textContent.trim()
doc.querySelector('[data-memory-atlas-mode-button="3d"]').click()
await waitFor(() => byTestId(doc, "memory-atlas-canvas").querySelector("canvas"), "3D canvas", 16000)
const urlsAfter = win.performance.getEntriesByType("resource").map((entry) => entry.name)
if (!urlsAfter.some((url) => url.includes("memory-atlas-3d.js"))) throw new Error("3D bundle did not lazy load")
if (byTestId(doc, "memory-atlas-detail-title").textContent.trim() !== selectedTitle) throw new Error("selection was not kept across 3D switch")
doc.querySelector('[data-memory-atlas-mode-button="2d"]').click()
await waitFor(() => canvas.dataset.runtimeMode === "2d" && !canvas.querySelector("canvas") && canvas.querySelector(".memory-atlas-2d__nodes button"), "2D restored and 3D canvas removed")
return { selectedTitle, lazyLoaded: true }
`),

  reducedMotion: wrap(`
const win = frameWindow("desktop-frame")
const originalMatchMedia = win.matchMedia
try {
  win.matchMedia = () => ({ matches: true, media: "(prefers-reduced-motion: reduce)", addEventListener() {}, removeEventListener() {} })
  win.document.dispatchEvent(new CustomEvent("nav", { detail: { url: new URL(win.location.href) } }))
  const doc = win.document
  await waitFor(() => byTestId(doc, "memory-atlas-canvas").dataset.runtimeMode === "2d", "reduced motion 2D ready")
  const ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
  if (!ragEntry || ragEntry.disabled) return { skipped: "RAG entrypoint unavailable" }
  ragEntry.click()
  await waitFor(() => doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${ragEntry.dataset.slug}"][data-selected="true"]\`), "RAG centered under reduced motion")
  const selected = doc.querySelector('.memory-atlas-2d__nodes button[data-selected="true"]')
  if (!selected) throw new Error("selected node missing under reduced motion")
  return { reducedMotion: true }
} finally {
  win.matchMedia = originalMatchMedia
}
`),

  semanticsFailureAndPrivacy: wrap(`
const win = frameWindow("desktop-frame")
const originalFetch = win.fetch.bind(win)
const fixtureDoc = win.document
const fixtureRagSlug = fixtureDoc.querySelector('[data-memory-atlas-entrypoint="rag"]')?.dataset.slug
if (!fixtureRagSlug) throw new Error("RAG entrypoint unavailable for semantics fixture")
const directWikiSlugs = new Set(
  [...fixtureDoc.querySelectorAll(".memory-atlas-2d__link--wiki")]
    .filter((link) => link.dataset.source === fixtureRagSlug || link.dataset.target === fixtureRagSlug)
    .map((link) => link.dataset.source === fixtureRagSlug ? link.dataset.target : link.dataset.source),
)
const fixtureTargetSlug = [...fixtureDoc.querySelectorAll(".memory-atlas-2d__nodes button")]
  .map((button) => button.dataset.slug)
  .find((slug) => slug && slug !== fixtureRagSlug && !directWikiSlugs.has(slug))
if (!fixtureTargetSlug) throw new Error("public semantics fixture target unavailable")
win.fetch = (input, init) => {
  const url = String(typeof input === "string" ? input : input?.url ?? "")
  if (url.includes("memory-atlas-semantics.json")) {
    return Promise.resolve(new Response(JSON.stringify({
      schemaVersion: 1,
      generatedAt: "2026-09-02T00:00:00.000Z",
      source: "qmd-vector",
      edges: [
        { source: fixtureRagSlug, target: fixtureTargetSlug, score: 0.91 },
        { source: fixtureRagSlug, target: "_private/concepts/private-secret-rag", score: 0.99, title: "Private Shadow Node" }
      ]
    }), { status: 200, headers: { "content-type": "application/json" } }))
  }
  return originalFetch(input, init)
}
win.document.dispatchEvent(new CustomEvent("nav", { detail: { url: new URL(win.location.href) } }))
const doc = win.document
await waitFor(() => byTestId(doc, "memory-atlas").dataset.semanticsState === "ready", "semantics fixture ready")
await waitFor(() => byTestId(doc, "memory-atlas-canvas").dataset.runtimeMode === "2d", "2D after semantics fixture")
await waitFor(() => doc.querySelector(".memory-atlas-2d__link--semantic"), "semantic edge rendered")
assertNoPrivateAtlasLeak(doc)
const semanticLinks = [...doc.querySelectorAll(".memory-atlas-2d__link--semantic")]
if (!semanticLinks.length) throw new Error("public semantic fixture did not reach graph")
if (!semanticLinks.some((link) => link.dataset.source === fixtureTargetSlug || link.dataset.target === fixtureTargetSlug)) {
  throw new Error("expected public semantic edge is missing")
}
win.fetch = (input, init) => {
  const url = String(typeof input === "string" ? input : input?.url ?? "")
  if (url.includes("memory-atlas-semantics.json")) return Promise.resolve(new Response("{}", { status: 500 }))
  return originalFetch(input, init)
}
win.document.dispatchEvent(new CustomEvent("nav", { detail: { url: new URL(win.location.href) } }))
await waitFor(() => byTestId(doc, "memory-atlas").dataset.semanticsState === "fallback", "semantics fallback")
assertNoPrivateAtlasLeak(doc)
win.fetch = originalFetch
return { semanticsFallback: true, privateLeak: false }
`),

  spaNavigationAndCleanup: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const root = byTestId(doc, "memory-atlas")
const canvas = byTestId(doc, "memory-atlas-canvas")
const ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
if (!ragEntry || ragEntry.disabled) throw new Error("RAG entrypoint unavailable")
const ragSlug = ragEntry.dataset.slug
ragEntry.click()
await waitFor(() => doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${ragSlug}"][data-selected="true"]\`), "RAG before SPA")
const selectedTitle = byTestId(doc, "memory-atlas-detail-title").textContent.trim()
const detailLink = byTestId(doc, "memory-atlas-detail-link")
detailLink.click()
await waitFor(() => !doc.querySelector('[data-testid="memory-atlas"]') && doc.querySelector(".memory-atlas-doc-return"), "SPA document page")
doc.querySelector(".memory-atlas-doc-return").click()
await waitFor(() => doc.querySelector('[data-testid="memory-atlas"]')?.dataset.runtimeState === "ready", "SPA home atlas ready", 16000)
await waitFor(() => byTestId(doc, "memory-atlas-detail-title").textContent.trim() === selectedTitle, "SPA restored selection")
await waitFor(() => byTestId(doc, "memory-atlas-canvas").dataset.runtimeMode === "2d", "SPA restored mode", 16000)
const beforeClear = activeNodeButtons(doc).map((button) => button.dataset.slug).sort()
if (!beforeClear.length) throw new Error("active relation missing before clear")
byTestId(doc, "memory-atlas-clear-selection").click()
await waitFor(() => byTestId(doc, "memory-atlas-context-title").textContent.trim() === "전체 지도", "selection cleared after SPA")
await waitFor(() => activeNodeButtons(doc).length === 0, "relation highlight cleared after SPA")
const revived = activeNodeButtons(doc).filter((button) => beforeClear.includes(button.dataset.slug))
if (revived.length) throw new Error("old relation highlight revived after clear")
return { spa: true, restoredMode: "2d", restoredSelection: selectedTitle }
`),

  brainAskRegression: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const originalFetch = win.fetch.bind(win)
const mode2d = doc.querySelector('[data-memory-atlas-mode-button="2d"]')
mode2d?.click()
await waitFor(() => byTestId(doc, "memory-atlas-canvas").dataset.runtimeMode === "2d", "2D before ask regression")
const askRagSlug = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')?.dataset.slug
if (!askRagSlug) throw new Error("RAG entrypoint unavailable for ask fixture")
win.fetch = (input, init) => {
  const url = String(typeof input === "string" ? input : input?.url ?? "")
  if (!url.includes("/api/brain/ask")) return originalFetch(input, init)
  const body = JSON.parse(init?.body ?? "{}")
  if (body.question === "empty") return Promise.resolve(new Response(JSON.stringify({ requestId: "2", answer: "", sources: [] }), { status: 200, headers: { "content-type": "application/json" } }))
  if (body.question === "error") return Promise.resolve(new Response(JSON.stringify({ error: { message: "boom", retryable: true } }), { status: 503, headers: { "content-type": "application/json" } }))
  return Promise.resolve(new Response(JSON.stringify({ requestId: "1", answer: "RAG 답변", sources: [{ title: "RAG", slug: askRagSlug, namespace: "public", score: 0.9, excerpt: "근거", href: \`/\${askRagSlug}\` }] }), { status: 200, headers: { "content-type": "application/json" } }))
}
byTestId(doc, "memory-atlas-ask-toggle").click()
const question = byTestId(doc, "memory-atlas-ask-question")
dispatchInput(question, "hello")
byTestId(doc, "memory-atlas-ask-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.askState === "success", "ask success")
if (!byTestId(doc, "memory-atlas-ask-answer-text").textContent.includes("RAG 답변")) throw new Error("answer missing")
await waitFor(() => byTestId(doc, "memory-atlas-canvas").dataset.evidenceCount === "1", "evidence highlighted")
doc.querySelector(".memory-atlas-2d__nodes button")?.click()
await waitFor(() => byTestId(doc, "memory-atlas-canvas").dataset.evidenceCount === "0", "evidence cleared")
dispatchInput(question, "empty")
byTestId(doc, "memory-atlas-ask-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.askState === "empty", "ask empty")
dispatchInput(question, "error")
byTestId(doc, "memory-atlas-ask-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.askState === "error", "ask error")
if (byTestId(doc, "memory-atlas-ask-retry").hidden) throw new Error("retry not shown")
byTestId(doc, "memory-atlas-ask-close").click()
await waitFor(() => byTestId(doc, "memory-atlas-ask-panel").hidden, "ask panel closed")
return { ask: true }
`),
}
