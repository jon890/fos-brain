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
/*
 * dispatchEvent 로 만든 PointerEvent 는 브라우저의 호환 click 을 만들지 않는다.
 * 노드 선택은 button 의 click handler 에서만 일어나므로 pointerup 뒤에 click 을 함께 보낸다.
 * pointermove 와 pointerup 도 대상 요소에 bubbles 로 보낸다.
 * runtime 은 이동과 종료를 window 에서 받으므로 요소에서 올라온 이벤트가 거기 닿는다.
 * window 에 직접 보내면 아래로 전파되지 않아 요소의 handler 가 받지 못한다.
 */
const dragPointer = (element, points, pointerId = 7) => {
  const win = element.ownerDocument.defaultView
  const init = (point, buttons) => ({
    pointerId,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons,
    clientX: point.x,
    clientY: point.y,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: win,
  })
  element.dispatchEvent(new win.PointerEvent("pointerdown", init(points[0], 1)))
  for (const point of points.slice(1)) {
    element.dispatchEvent(new win.PointerEvent("pointermove", init(point, 1)))
  }
  const last = points[points.length - 1]
  element.dispatchEvent(new win.PointerEvent("pointerup", init(last, 0)))
  element.dispatchEvent(new win.MouseEvent("click", init(last, 0)))
}
const wheelAt = (element, point, deltaY) => {
  const win = element.ownerDocument.defaultView
  element.dispatchEvent(
    new win.WheelEvent("wheel", {
      deltaY,
      deltaMode: 0,
      clientX: point.x,
      clientY: point.y,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: win,
    }),
  )
}
const viewportWrapper = (canvas) => {
  const wrapper = canvas.querySelector(".memory-atlas-2d__viewport")
  if (!wrapper) throw new Error("missing 2D viewport wrapper")
  return wrapper
}
const viewportTranslate = (canvas) => {
  const match = /translate\\((-?[\\d.]+)px,\\s*(-?[\\d.]+)px\\)\\s*scale\\((-?[\\d.]+)\\)/.exec(
    viewportWrapper(canvas).style.transform || "",
  )
  if (!match) throw new Error(\`unreadable viewport transform: \${viewportWrapper(canvas).style.transform}\`)
  return { x: Number(match[1]), y: Number(match[2]), k: Number(match[3]) }
}
const emptyMapPoint = (doc, canvas) => {
  const rect = canvas.getBoundingClientRect()
  for (let ratioY = 0.2; ratioY <= 0.8; ratioY += 0.1) {
    for (let ratioX = 0.3; ratioX <= 0.7; ratioX += 0.1) {
      const x = rect.left + rect.width * ratioX
      const y = rect.top + rect.height * ratioY
      const hit = doc.elementFromPoint(x, y)
      if (hit && canvas.contains(hit) && !hit.closest(".memory-atlas-2d__nodes button")) {
        return { element: hit, x, y }
      }
    }
  }
  throw new Error("no empty spot on the 2D map")
}
const selectedSlug = (canvas) =>
  canvas.querySelector(".memory-atlas-2d__nodes button[data-selected='true']")?.dataset.slug
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

  ragEntrypointSelected: `(() => {
    const doc = document.getElementById("desktop-frame")?.contentDocument
    const slug = doc?.querySelector('[data-memory-atlas-entrypoint="rag"]')?.dataset.slug
    return Boolean(slug && doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${slug}"][data-selected="true"]\`))
  })()`,

  viewportBasics: wrap(`
const results = {}
for (const id of ["desktop-frame", "mobile-frame"]) {
  const win = frameWindow(id)
  const doc = win.document
  await waitFor(() => byTestId(doc, "memory-atlas").dataset.runtimeState === "ready", \`\${id} atlas ready\`)
  const root = byTestId(doc, "memory-atlas")
  const canvas = byTestId(doc, "memory-atlas-canvas")
  if (root.dataset.runtimeState !== "ready") throw new Error(\`\${id} runtime not ready\`)
  await waitFor(() => root.dataset.authState === "public", \`\${id} public auth ready\`)
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
  const login = byTestId(doc, "memory-atlas-login-open")
  login.click()
  const dialog = byTestId(doc, "memory-atlas-login-dialog")
  if (!dialog.open) throw new Error(\`\${id} login dialog did not open\`)
  const dialogRect = dialog.getBoundingClientRect()
  if (dialogRect.left < -2 || dialogRect.right > doc.documentElement.clientWidth + 2 || dialogRect.top < -2 || dialogRect.bottom > doc.documentElement.clientHeight + 2) throw new Error(\`\${id} login dialog overflow\`)
  if (byTestId(doc, "memory-atlas-login-password").type !== "password") throw new Error(\`\${id} login input is not a password field\`)
  byTestId(doc, "memory-atlas-login-cancel").click()
  results[id] = { nodes: buttons.length, links: canvas.querySelectorAll(".memory-atlas-2d__link").length }
}
return results
`),

  navigationDocumentsExcluded: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const canvas = byTestId(doc, "memory-atlas-canvas")
const index = await win.fetch("/static/contentIndex.json").then((response) => {
  if (!response.ok) throw new Error(\`content index fetch failed with status \${response.status}\`)
  return response.json()
})
const navigationSlugs = Object.entries(index).filter(([, details]) => details.role === "navigation").map(([slug]) => slug)
if (!navigationSlugs.length) throw new Error("no navigation document in the content index; the assertion would check nothing")
const present = navigationSlugs.filter((navigationSlug) => canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${navigationSlug}"]\`))
if (present.length) throw new Error(\`navigation documents reached the graph: \${present.join(", ")}\`)
const knowledgeSlug = Object.entries(index).find(([, details]) => details.role !== "navigation")?.[0]
if (!knowledgeSlug) throw new Error("no knowledge document in the content index")
if (!canvas.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${knowledgeSlug}"]\`)) throw new Error(\`the node selector matched nothing for \${knowledgeSlug}; the absence check above proves nothing\`)
return { navigationSlugs, knowledgeSlug, graphNodes: canvas.querySelectorAll(".memory-atlas-2d__nodes button").length }
`),

  selectRagEntrypoint: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const ragEntry = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')
if (!ragEntry || ragEntry.disabled) throw new Error("RAG entrypoint unavailable")
ragEntry.click()
return { selected: ragEntry.dataset.slug }
`),

  localRelationFlow: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const root = byTestId(doc, "memory-atlas")
const canvas = byTestId(doc, "memory-atlas-canvas")
const globalNodeCount = canvas.querySelectorAll(".memory-atlas-2d__nodes button").length
const ragSlug = doc.querySelector('[data-memory-atlas-entrypoint="rag"]')?.dataset.slug
if (!ragSlug) throw new Error("RAG entrypoint unavailable")
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

  twoDimensionalViewportControls: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const canvas = byTestId(doc, "memory-atlas-canvas")
const reset = byTestId(doc, "memory-atlas-reset-viewport")
const zoomIn = byTestId(doc, "memory-atlas-zoom-in")
const zoomOut = byTestId(doc, "memory-atlas-zoom-out")
if (byTestId(doc, "memory-atlas-viewport-controls").hidden) throw new Error("viewport controls are hidden in 2D")
const labels = byTestId(doc, "memory-atlas-labels")
const rerender = async (checked) => {
  labels.checked = checked
  labels.dispatchEvent(new Event("change", { bubbles: true }))
  await waitFor(
    () =>
      [...canvas.querySelectorAll(".memory-atlas-2d__label")].every(
        (label) => (Number(label.style.opacity) === 0) === !checked,
      ),
    \`labels \${checked ? "shown" : "hidden"}\`,
  )
}
const dragBy = (deltaX, deltaY) => {
  const spot = emptyMapPoint(doc, canvas)
  dragPointer(spot.element, [
    { x: spot.x, y: spot.y },
    { x: spot.x + deltaX, y: spot.y + deltaY },
  ])
}

reset.click()
if (viewportTranslate(canvas).x !== 0) throw new Error("전체 보기 did not start from the initial viewport")

// 빈 곳 드래그가 지도를 옮긴다.
dragBy(60, 40)
const afterEmptyDrag = viewportTranslate(canvas)
if (afterEmptyDrag.x !== 60 || afterEmptyDrag.y !== 40) throw new Error(\`empty-space drag moved the map to \${JSON.stringify(afterEmptyDrag)}\`)

// 다시 그려도 이동값이 남는다.
await rerender(false)
await rerender(true)
const afterRerender = viewportTranslate(canvas)
if (afterRerender.x !== 60 || afterRerender.y !== 40) throw new Error(\`viewport was lost on rerender: \${JSON.stringify(afterRerender)}\`)

// handler 가 렌더마다 쌓이면 같은 드래그가 배수로 움직인다.
reset.click()
dragBy(50, 0)
const accumulated = viewportTranslate(canvas)
if (accumulated.x !== 50) throw new Error(\`drag distance scaled with rerenders: \${accumulated.x}\`)

// 휠이 배율을 바꾸고 포인터 아래 지점이 그 자리에 남는다.
reset.click()
const zoomSpot = emptyMapPoint(doc, canvas)
const canvasRect = canvas.getBoundingClientRect()
const localZoom = { x: zoomSpot.x - canvasRect.left, y: zoomSpot.y - canvasRect.top }
const beforeZoom = viewportTranslate(canvas)
const sceneUnderPointer = {
  x: (localZoom.x - beforeZoom.x) / beforeZoom.k,
  y: (localZoom.y - beforeZoom.y) / beforeZoom.k,
}
wheelAt(zoomSpot.element, zoomSpot, -240)
const afterZoom = viewportTranslate(canvas)
if (!(afterZoom.k > beforeZoom.k)) throw new Error(\`wheel did not zoom in: \${JSON.stringify(afterZoom)}\`)
const heldX = afterZoom.x + sceneUnderPointer.x * afterZoom.k
const heldY = afterZoom.y + sceneUnderPointer.y * afterZoom.k
if (Math.abs(heldX - localZoom.x) > 0.5 || Math.abs(heldY - localZoom.y) > 0.5) throw new Error(\`wheel moved the point under the pointer: \${heldX},\${heldY} vs \${localZoom.x},\${localZoom.y}\`)
wheelAt(zoomSpot.element, zoomSpot, 240)

// 배율 버튼은 포인터 없이도 배율을 바꾼다. 터치와 키보드에 남는 유일한 수단이다.
reset.click()
zoomIn.click()
const afterZoomIn = viewportTranslate(canvas)
if (!(afterZoomIn.k > 1)) throw new Error(\`확대 did not raise the scale: \${JSON.stringify(afterZoomIn)}\`)
zoomOut.click()
const afterZoomOut = viewportTranslate(canvas)
if (Math.abs(afterZoomOut.k - 1) > 0.001) throw new Error(\`축소 did not undo 확대: \${JSON.stringify(afterZoomOut)}\`)

// 노드 위에서 끌어도 지도가 움직이고 선택은 바뀌지 않는다.
reset.click()
const selectionBeforeNodeDrag = selectedSlug(canvas)
const nodeToDrag = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")].find(
  (button) => button.dataset.selected !== "true",
)
if (!nodeToDrag) throw new Error("no unselected node button to drag")
const nodeRect = nodeToDrag.getBoundingClientRect()
const nodeCenter = { x: nodeRect.left + nodeRect.width / 2, y: nodeRect.top + nodeRect.height / 2 }
dragPointer(nodeToDrag, [nodeCenter, { x: nodeCenter.x + 70, y: nodeCenter.y - 30 }])
const afterNodeDrag = viewportTranslate(canvas)
if (afterNodeDrag.x !== 70 || afterNodeDrag.y !== -30) throw new Error(\`node drag did not move the map: \${JSON.stringify(afterNodeDrag)}\`)
if (selectedSlug(canvas) !== selectionBeforeNodeDrag) throw new Error("node drag changed the selection")

// 4px 미만의 짧은 누름은 그 노드를 선택한다.
// 선택 전에 지도를 옮겨 두어야 선택이 이동을 다시 맞추는지 판정할 수 있다.
reset.click()
dragBy(80, 55)
if (viewportTranslate(canvas).x !== 80) throw new Error("drag before the short press did not move the map")
const nodeToTap = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")].find(
  (button) => button.dataset.selected !== "true",
)
if (!nodeToTap) throw new Error("no unselected node button to tap")
const tapSlug = nodeToTap.dataset.slug
const tapRect = nodeToTap.getBoundingClientRect()
const tapCenter = { x: tapRect.left + tapRect.width / 2, y: tapRect.top + tapRect.height / 2 }
dragPointer(nodeToTap, [tapCenter, { x: tapCenter.x + 1, y: tapCenter.y + 1 }])
await waitFor(() => selectedSlug(canvas) === tapSlug, "short press selects the node")

// 선택으로 중심이 바뀌면 배율은 그대로 두고 이동만 새 중심에 맞춘다.
const afterSelect = viewportTranslate(canvas)
if (afterSelect.x !== 0 || afterSelect.y !== 0 || afterSelect.k !== 1) throw new Error(\`selection did not recenter the viewport: \${JSON.stringify(afterSelect)}\`)

// 확대한 채 노드를 고르면 그 배율이 유지되고 선택 노드가 화면 중앙에 온다.
const centeredFor = (k) => {
  const rect = canvas.getBoundingClientRect()
  const width = Math.max(320, Math.floor(rect.width))
  const height = Math.max(320, Math.floor(rect.height))
  return { x: (width - width * k) / 2, y: (height - height * k) / 2 }
}
zoomIn.click()
const zoomedScale = viewportTranslate(canvas).k
dragBy(60, -40)
const nodeToTapZoomed = [...canvas.querySelectorAll(".memory-atlas-2d__nodes button")].find(
  (button) => button.dataset.selected !== "true",
)
if (!nodeToTapZoomed) throw new Error("no unselected node button to tap while zoomed")
const zoomedSlug = nodeToTapZoomed.dataset.slug
const zoomedRect = nodeToTapZoomed.getBoundingClientRect()
const zoomedCenter = { x: zoomedRect.left + zoomedRect.width / 2, y: zoomedRect.top + zoomedRect.height / 2 }
dragPointer(nodeToTapZoomed, [zoomedCenter, { x: zoomedCenter.x + 1, y: zoomedCenter.y + 1 }])
await waitFor(() => selectedSlug(canvas) === zoomedSlug, "short press selects the node while zoomed")
const afterZoomedSelect = viewportTranslate(canvas)
if (Math.abs(afterZoomedSelect.k - zoomedScale) > 0.001) throw new Error(\`selection changed the scale: \${JSON.stringify(afterZoomedSelect)}\`)
const expectedCenter = centeredFor(afterZoomedSelect.k)
if (Math.abs(afterZoomedSelect.x - expectedCenter.x) > 0.5 || Math.abs(afterZoomedSelect.y - expectedCenter.y) > 0.5) throw new Error(\`selection did not center the scene: \${JSON.stringify(afterZoomedSelect)} vs \${JSON.stringify(expectedCenter)}\`)

// 뒤 판정들은 배율 1 을 전제하므로 여기서 되돌린다.
reset.click()

// 전체 보기는 시야만 되돌리고 선택은 유지한다.
dragBy(45, -25)
if (viewportTranslate(canvas).x !== 45) throw new Error("drag before 전체 보기 did not move the map")
reset.click()
const afterResetClick = viewportTranslate(canvas)
if (afterResetClick.x !== 0 || afterResetClick.y !== 0 || afterResetClick.k !== 1) throw new Error(\`전체 보기 did not restore the viewport: \${JSON.stringify(afterResetClick)}\`)
if (selectedSlug(canvas) !== zoomedSlug) throw new Error("전체 보기 changed the selection")

// 선택을 해제해도 이동이 다시 맞춰진다.
dragBy(35, 15)
byTestId(doc, "memory-atlas-clear-selection").click()
await waitFor(() => byTestId(doc, "memory-atlas-context-title").textContent.trim() === "전체 지도", "selection cleared")
const afterClear = viewportTranslate(canvas)
if (afterClear.x !== 0 || afterClear.y !== 0 || afterClear.k !== 1) throw new Error(\`clearing the selection did not recenter the viewport: \${JSON.stringify(afterClear)}\`)

reset.click()
noHorizontalOverflow(doc)
return { emptyDrag: afterEmptyDrag, nodeDrag: afterNodeDrag, tapped: tapSlug }
`),

  viewportResetHiddenInThreeD: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const canvas = byTestId(doc, "memory-atlas-canvas")
const controls = byTestId(doc, "memory-atlas-viewport-controls")
if (controls.hidden) throw new Error("viewport controls are hidden while 2D is active")
doc.querySelector('[data-memory-atlas-mode-button="3d"]').click()
await waitFor(() => canvas.querySelector("canvas"), "3D canvas", 16000)
await waitFor(() => controls.hidden, "viewport controls hidden in 3D")
doc.querySelector('[data-memory-atlas-mode-button="2d"]').click()
await waitFor(() => canvas.dataset.runtimeMode === "2d" && canvas.querySelector(".memory-atlas-2d__nodes button"), "2D restored")
await waitFor(() => !controls.hidden, "viewport controls shown again in 2D")
byTestId(doc, "memory-atlas-reset-viewport").click()
return { hiddenInThreeD: true }
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

  authAndProtectedDataLifecycle: wrap(`
const win = frameWindow("desktop-frame")
const doc = win.document
const root = byTestId(doc, "memory-atlas")
const originalFetch = win.fetch.bind(win)
await waitFor(() => root.dataset.authState === "public", "initial public auth state")
assertNoPrivateAtlasLeak(doc)
if (root.dataset.availableNamespaces !== "public") throw new Error("public namespaces were not fixed before login")
if (!byTestId(doc, "memory-atlas-ask-toggle").hidden) throw new Error("question UI was visible before protected data")

const publicIndexResponse = await originalFetch("/static/contentIndex.json")
const publicIndexText = await publicIndexResponse.text()
if (publicIndexText.includes("private-auth-fixture")) throw new Error("private fixture reached the public content index")
const publicIndex = JSON.parse(publicIndexText)
const publicSemantics = await originalFetch("/static/memory-atlas-semantics.json")
  .then((response) => response.ok ? response.json() : ({ schemaVersion: 1, generatedAt: "2026-09-03T00:00:00.000Z", source: "qmd-vector", edges: [] }))
const privateSlug = "_private/concepts/private-auth-fixture"
const privateTitle = "Private Auth Fixture"
const protectedIndex = {
  ...publicIndex,
  [privateSlug]: {
    slug: privateSlug,
    filePath: "concepts/private-auth-fixture.md",
    title: privateTitle,
    links: [],
    tags: ["private-only"],
    content: "protected fixture",
    type: "concept",
    sourceCount: 1,
  },
}
let loginMode = "public"
let protectedRequests = 0
const json = (value, init = {}) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" }, ...init })
win.fetch = (input, init) => {
  const url = String(typeof input === "string" ? input : input?.url ?? "")
  if (url.includes("/api/auth/session")) return Promise.resolve(json({ role: "public", expiresAt: null }))
  if (url.includes("/api/auth/login")) {
    const password = JSON.parse(init?.body ?? "{}").password
    if (password === "wrong-password") return Promise.resolve(json({ error: { code: "invalid_credentials" } }, { status: 401 }))
    if (password === "limited-password") return Promise.resolve(json({ error: { code: "login_rate_limited" } }, { status: 429, headers: { "content-type": "application/json", "retry-after": "60" } }))
    loginMode = password === "private-fail-password" ? "private-fail" : password === "expiring-password" ? "expiring" : "admin"
    const expiresAt = new Date(Date.now() + (loginMode === "expiring" ? 700 : 60_000)).toISOString()
    return Promise.resolve(json({ role: "admin", expiresAt }))
  }
  if (url.includes("/api/auth/logout")) {
    loginMode = "public"
    return Promise.resolve(new Response(null, { status: 204 }))
  }
  if (url.includes("/api/private/content-index")) {
    protectedRequests += 1
    if (loginMode === "private-fail") return Promise.resolve(json({ error: { code: "private_content_unavailable" } }, { status: 503 }))
    return Promise.resolve(json(protectedIndex))
  }
  if (url.includes("/api/private/memory-atlas-semantics")) {
    protectedRequests += 1
    return Promise.resolve(json(publicSemantics))
  }
  return originalFetch(input, init)
}

win.document.dispatchEvent(new CustomEvent("nav", { detail: { url: new URL(win.location.href) } }))
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "public", "mocked public session")
if (protectedRequests !== 0) throw new Error("protected data was requested for a public session")

const openLogin = () => {
  byTestId(doc, "memory-atlas-login-open").click()
  const dialog = byTestId(doc, "memory-atlas-login-dialog")
  if (!dialog.open) throw new Error("login dialog did not open")
  return byTestId(doc, "memory-atlas-login-password")
}
let password = openLogin()
dispatchInput(password, "wrong-password")
byTestId(doc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas-login-status").textContent.includes("확인할 수 없습니다"), "generic login failure")
if (password.value) throw new Error("failed password remained in the input")
dispatchInput(password, "limited-password")
byTestId(doc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas-login-status").textContent.includes("이후 다시 시도하세요"), "rate limit retry guidance")
if (byTestId(doc, "memory-atlas-login-status").textContent.includes("15분 뒤")) throw new Error("rate limit response ignored Retry-After")
if (password.value) throw new Error("limited password remained in the input")

dispatchInput(password, "correct-password")
byTestId(doc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "admin", "admin protected data")
await waitFor(() => doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${privateSlug}"]\`), "private node rendered")
const namespaceValues = [...doc.querySelectorAll('input[name="memory-atlas-namespace"]')].map((input) => input.value)
if (namespaceValues.join(",") !== "public,private") throw new Error(\`admin namespace controls mismatch: \${namespaceValues}\`)
if (root.dataset.availableNamespaces !== "public,private") throw new Error("admin namespace dataset mismatch")
if (byTestId(doc, "memory-atlas-ask-toggle").hidden) throw new Error("question UI remained hidden after protected data")
const storedAdmin = JSON.parse(win.sessionStorage.getItem("memoryAtlasState") || "{}")
const effectiveAdminNamespaces = storedAdmin.namespaces?.length ? storedAdmin.namespaces : root.dataset.availableNamespaces.split(",")
if (!effectiveAdminNamespaces.includes("private")) throw new Error("admin storage and namespace DOM disagree")
if ([...doc.querySelectorAll("input")].some((input) => input.value === "correct-password")) throw new Error("successful password remained in the DOM")
for (const storage of [win.localStorage, win.sessionStorage]) {
  for (let index = 0; index < storage.length; index += 1) {
    const value = storage.getItem(storage.key(index)) || ""
    if (["wrong-password", "limited-password", "correct-password"].some((secret) => value.includes(secret))) throw new Error("password reached browser storage")
  }
}

doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${privateSlug}"]\`).click()
await waitFor(() => byTestId(doc, "memory-atlas-detail-title").textContent.trim() === privateTitle, "private detail selected")
byTestId(doc, "memory-atlas-logout").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "public", "logout public state")
await waitFor(() => !doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${privateSlug}"]\`), "private node removed after logout")
if (root.dataset.availableNamespaces !== "public") throw new Error("logout namespace dataset retained private")
if (doc.querySelector('input[name="memory-atlas-namespace"][value="private"]')) throw new Error("logout retained private checkbox")
if (!byTestId(doc, "memory-atlas-ask-toggle").hidden || !byTestId(doc, "memory-atlas-ask-panel").hidden) throw new Error("logout retained question UI")
if (byTestId(doc, "memory-atlas-detail-title").textContent.includes(privateTitle)) throw new Error("logout retained private detail")
const storedAfterLogout = win.sessionStorage.getItem("memoryAtlasState") || ""
if (storedAfterLogout.includes("private") || storedAfterLogout.includes(privateSlug) || storedAfterLogout.includes("private-only")) throw new Error("logout retained private session state")
assertNoPrivateAtlasLeak(doc)

password = openLogin()
dispatchInput(password, "private-fail-password")
byTestId(doc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "error", "private API failure")
if (!byTestId(doc, "memory-atlas-login-status").textContent.includes("관리자 데이터를 불러오지 못했습니다")) throw new Error("private API failure guidance missing")
if (root.dataset.availableNamespaces !== "public" || doc.body.innerHTML.includes(privateSlug)) throw new Error("private API failure partially retained protected data")
byTestId(doc, "memory-atlas-login-cancel").click()

password = openLogin()
dispatchInput(password, "expiring-password")
byTestId(doc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "admin", "expiring admin session")
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "public", "automatic session expiry", 4000)
await waitFor(() => !doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${privateSlug}"]\`), "session expiry private graph cleanup")
if (root.dataset.availableNamespaces !== "public" || doc.body.innerHTML.includes(privateSlug)) throw new Error("session expiry retained private data")

password = openLogin()
dispatchInput(password, "correct-password")
byTestId(doc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "admin", "admin restored for question regression")

const mobileWin = frameWindow("mobile-frame")
const mobileDoc = mobileWin.document
const mobileOriginalFetch = mobileWin.fetch.bind(mobileWin)
mobileWin.fetch = (input, init) => {
  const url = String(typeof input === "string" ? input : input?.url ?? "")
  if (url.includes("/api/auth/session")) return Promise.resolve(json({ role: "public", expiresAt: null }))
  if (url.includes("/api/auth/login")) return Promise.resolve(json({ role: "admin", expiresAt: new Date(Date.now() + 60_000).toISOString() }))
  if (url.includes("/api/private/content-index")) return Promise.resolve(json(protectedIndex))
  if (url.includes("/api/private/memory-atlas-semantics")) return Promise.resolve(json(publicSemantics))
  return mobileOriginalFetch(input, init)
}
mobileWin.document.dispatchEvent(new CustomEvent("nav", { detail: { url: new URL(mobileWin.location.href) } }))
await waitFor(() => byTestId(mobileDoc, "memory-atlas").dataset.authState === "public", "mobile public session")
byTestId(mobileDoc, "memory-atlas-login-open").click()
const mobilePassword = byTestId(mobileDoc, "memory-atlas-login-password")
dispatchInput(mobilePassword, "correct-password")
byTestId(mobileDoc, "memory-atlas-login-submit").click()
await waitFor(() => byTestId(mobileDoc, "memory-atlas").dataset.authState === "admin", "mobile admin protected data")
await waitFor(() => mobileDoc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${privateSlug}"]\`), "mobile private graph")
noHorizontalOverflow(mobileDoc)
if (byTestId(mobileDoc, "memory-atlas-auth-status").textContent.trim() !== "관리자") throw new Error("mobile administrator status missing")
return { publicFirst: true, loginFailure: true, limited: true, admin: true, logout: true, expired: true, privateFailure: true, protectedRequests, mobileAdmin: true }
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
const privateSlug = doc.querySelector('.memory-atlas-2d__nodes button[data-slug^="_private/"]')?.dataset.slug
if (!privateSlug) throw new Error("private node unavailable for ask fixture")
win.fetch = (input, init) => {
  const url = String(typeof input === "string" ? input : input?.url ?? "")
  if (!url.includes("/api/brain/ask")) return originalFetch(input, init)
  const body = JSON.parse(init?.body ?? "{}")
  if (body.question === "empty") return Promise.resolve(new Response(JSON.stringify({ requestId: "2", answer: "", sources: [] }), { status: 200, headers: { "content-type": "application/json" } }))
  if (body.question === "error") return Promise.resolve(new Response(JSON.stringify({ error: { message: "boom", retryable: true } }), { status: 503, headers: { "content-type": "application/json" } }))
  if (body.question === "private-sources") return Promise.resolve(new Response(JSON.stringify({ requestId: "3", answer: "비공개 근거", sources: [
    { title: "허용", slug: privateSlug, namespace: "private", score: 0.95, excerpt: "허용 근거", href: \`/\${privateSlug}\` },
    { title: "경로 위조", slug: privateSlug, namespace: "private", score: 0.9, excerpt: "차단", href: \`/\${askRagSlug}\` },
    { title: "외부 위조", slug: privateSlug, namespace: "private", score: 0.85, excerpt: "차단", href: "https://attacker.example/_private/stolen" }
  ] }), { status: 200, headers: { "content-type": "application/json" } }))
  if (body.question === "expired") return Promise.resolve(new Response(JSON.stringify({ error: { code: "authentication_required" } }), { status: 401, headers: { "content-type": "application/json" } }))
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
dispatchInput(question, "private-sources")
byTestId(doc, "memory-atlas-ask-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.askState === "success", "private source answer")
const sources = [...byTestId(doc, "memory-atlas-ask-source-list").querySelectorAll("li")]
const acceptedSource = sources[0]?.querySelector("a")
if (sources.length !== 1 || acceptedSource?.dataset.slug !== privateSlug || acceptedSource?.getAttribute("href") !== \`/\${privateSlug}\`) throw new Error(\`unsafe private source href was accepted: count=\${sources.length}, href=\${acceptedSource?.getAttribute("href")}\`)
dispatchInput(question, "expired")
byTestId(doc, "memory-atlas-ask-submit").click()
await waitFor(() => byTestId(doc, "memory-atlas").dataset.authState === "public", "question 401 public fallback")
if (!byTestId(doc, "memory-atlas-ask-panel").hidden || byTestId(doc, "memory-atlas-ask-answer-text").textContent) throw new Error("question 401 retained question UI or answer")
await waitFor(() => !doc.querySelector(\`.memory-atlas-2d__nodes button[data-slug="\${privateSlug}"]\`), "question 401 private graph cleanup")
if (doc.body.innerHTML.includes(privateSlug) || byTestId(doc, "memory-atlas").dataset.availableNamespaces !== "public") throw new Error("question 401 retained protected data")
return { ask: true, privateHref: true, unauthorizedCleanup: true }
`),
}
