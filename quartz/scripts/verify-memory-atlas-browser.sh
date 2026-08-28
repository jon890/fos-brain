#!/usr/bin/env bash
set -Eeuo pipefail

# Caller contract: pass the URL of an already running local static Quartz server.
# This script owns only the fixed agent-browser session, routes, and evidence dir.

SESSION="plan4-memory-atlas"
NAMESPACE_COUNTER=0
NAMESPACE="p4ma-$$-$NAMESPACE_COUNTER"
EVIDENCE_DIR="/tmp/fos-brain-memory-atlas-plan4"
ROUTE_PATTERN="**/static/contentIndex.json"
AB_TIMEOUT_SECONDS="${AB_TIMEOUT_SECONDS:-45}"

if [[ $# -ne 1 || -z "${1:-}" ]]; then
  echo "usage: $0 <local-static-server-url>" >&2
  exit 2
fi

BASE_URL="${1%/}"
ASSERTIONS_JSONL="$EVIDENCE_DIR/assertions.jsonl"
ASSERTIONS_JSON="$EVIDENCE_DIR/assertions.json"
FAILURES=0
ROUTE_ACTIVE=0

export AGENT_BROWSER_RESTORE_SAVE=never
export AGENT_BROWSER_DEFAULT_TIMEOUT=30000

mkdir -p "$EVIDENCE_DIR"
rm -f "$EVIDENCE_DIR"/*
: >"$ASSERTIONS_JSONL"

run_with_timeout() {
  local seconds="$1"
  shift
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$seconds" "$@"
  elif command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  else
    perl -e 'alarm shift @ARGV; exec @ARGV or die "exec failed: $!\n"' "$seconds" "$@"
  fi
}

ab() {
  run_with_timeout "$AB_TIMEOUT_SECONDS" agent-browser --namespace "$NAMESPACE" --session "$SESSION" --screenshot-dir "$EVIDENCE_DIR" "$@"
}

restart_browser_namespace() {
  local old_namespace="$NAMESPACE"
  NAMESPACE_COUNTER=$((NAMESPACE_COUNTER + 1))
  NAMESPACE="p4ma-$$-$NAMESPACE_COUNTER"
  {
    echo "Restarting agent-browser namespace after timeout: $old_namespace -> $NAMESPACE"
    run_with_timeout 10 agent-browser --namespace "$old_namespace" --session "$SESSION" close
    run_with_timeout 10 agent-browser --namespace "$NAMESPACE" --session "$SESSION" --screenshot-dir "$EVIDENCE_DIR" open about:blank
  } >>"$EVIDENCE_DIR/session-restarts.log" 2>&1 || true
}

maybe_restart_after_timeout() {
  local stderr_file="$1"
  if grep -Eq "Alarm clock|timed out|Timeout" "$stderr_file"; then
    restart_browser_namespace
  fi
}

rotate_namespace() {
  local label="$1"
  local old_namespace="$NAMESPACE"
  NAMESPACE_COUNTER=$((NAMESPACE_COUNTER + 1))
  NAMESPACE="p4ma-$$-$NAMESPACE_COUNTER"
  {
    echo "Rotating agent-browser namespace for $label: $old_namespace -> $NAMESPACE"
    run_with_timeout 8 agent-browser --namespace "$old_namespace" --session "$SESSION" close
  } >>"$EVIDENCE_DIR/session-restarts.log" 2>&1 || true
}

append_assertion() {
  local name="$1"
  local status="$2"
  local output_file="$3"

  node - "$ASSERTIONS_JSONL" "$name" "$status" "$output_file" <<'NODE'
const fs = require("fs")
const [path, name, status, outputFile] = process.argv.slice(2)
const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8") : ""
fs.appendFileSync(path, `${JSON.stringify({ name, status, output })}\n`)
NODE
}

finalize_assertions() {
  node - "$ASSERTIONS_JSONL" "$ASSERTIONS_JSON" <<'NODE'
const fs = require("fs")
const [input, output] = process.argv.slice(2)
const rows = fs.existsSync(input)
  ? fs.readFileSync(input, "utf8").split(/\n/).filter(Boolean).map((line) => JSON.parse(line))
  : []
fs.writeFileSync(output, `${JSON.stringify(rows, null, 2)}\n`)
NODE
}

cleanup() {
  set +e
  if [[ "$ROUTE_ACTIVE" -eq 1 ]]; then
    ab network unroute "$ROUTE_PATTERN" >/dev/null 2>&1
  fi
  ab network requests --json >"$EVIDENCE_DIR/network-final.json" 2>"$EVIDENCE_DIR/network-final.stderr" || true
  ab errors --json >"$EVIDENCE_DIR/browser-errors-final.json" 2>"$EVIDENCE_DIR/browser-errors-final.stderr" || true
  ab close >"$EVIDENCE_DIR/session-close.log" 2>&1 || true
  finalize_assertions || true
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  FAILURES=$((FAILURES + 1))
}

assert_eval() {
  local name="$1"
  local stdout_file="$EVIDENCE_DIR/assert-${name}.stdout"
  local stderr_file="$EVIDENCE_DIR/assert-${name}.stderr"
  local js_file="$EVIDENCE_DIR/assert-${name}.js"
  cat >"$js_file"
  if {
    printf '(async () => {\n'
    cat "$js_file"
    printf '\n})()\n'
  } | ab eval --stdin >"$stdout_file" 2>"$stderr_file"; then
    append_assertion "$name" "passed" "$stdout_file"
  else
    append_assertion "$name" "failed" "$stderr_file"
    fail "$name"
    maybe_restart_after_timeout "$stderr_file"
  fi
}

wait_ready() {
  ab wait --fn "document.querySelector('[data-testid=\"memory-atlas\"]')?.dataset.runtimeState === 'ready'" >/dev/null
}

capture_errors() {
  local name="$1"
  local stderr_file="$EVIDENCE_DIR/capture-errors-$name.stderr"
  if ! ab errors --json >"$EVIDENCE_DIR/browser-errors-$name.json" 2>"$stderr_file"; then
    fail "capture-browser-errors-$name"
    maybe_restart_after_timeout "$stderr_file"
  fi
  stderr_file="$EVIDENCE_DIR/capture-console-$name.stderr"
  if ! ab console --json >"$EVIDENCE_DIR/console-$name.json" 2>"$stderr_file"; then
    fail "capture-console-$name"
    maybe_restart_after_timeout "$stderr_file"
  fi
}

capture_network() {
  local name="$1"
  local stderr_file="$EVIDENCE_DIR/capture-network-$name.stderr"
  if ! ab network requests --json >"$EVIDENCE_DIR/network-$name.json" 2>"$stderr_file"; then
    fail "capture-network-$name"
    maybe_restart_after_timeout "$stderr_file"
  fi
}

capture_snapshot() {
  local name="$1"
  local stderr_file="$EVIDENCE_DIR/capture-snapshot-$name.stderr"
  local retry_stderr_file="$EVIDENCE_DIR/capture-snapshot-$name.retry.stderr"
  if ab snapshot >"$EVIDENCE_DIR/$name.snapshot.txt" 2>"$stderr_file"; then
    return
  fi

  if grep -Eq "Alarm clock|timed out|Timeout" "$stderr_file"; then
    if ab snapshot >"$EVIDENCE_DIR/$name.snapshot.txt" 2>"$retry_stderr_file"; then
      {
        echo "Snapshot capture retry succeeded for $name"
        cat "$stderr_file"
      } >"$EVIDENCE_DIR/capture-snapshot-$name.retry.log"
      return
    fi
    fail "capture-snapshot-$name"
    maybe_restart_after_timeout "$retry_stderr_file"
  else
    fail "capture-snapshot-$name"
    maybe_restart_after_timeout "$stderr_file"
  fi
}

capture_screenshot() {
  local name="$1"
  local stderr_file="$EVIDENCE_DIR/capture-screenshot-$name.stderr"
  if ! ab screenshot "$EVIDENCE_DIR/$name.png" >"$EVIDENCE_DIR/capture-screenshot-$name.stdout" 2>"$stderr_file"; then
    fail "capture-screenshot-$name"
    maybe_restart_after_timeout "$stderr_file"
  fi
}

open_desktop_home() {
  ab network requests --clear >/dev/null
  ab errors --clear >/dev/null
  ab console --clear >/dev/null
  ab set viewport 1440 1000 >/dev/null
  ab open "$BASE_URL" >/dev/null
  wait_ready
}

open_mobile_home() {
  ab network requests --clear >/dev/null
  ab errors --clear >/dev/null
  ab console --clear >/dev/null
  ab set viewport 390 844 >/dev/null
  ab set media dark reduced-motion >/dev/null
  ab open "$BASE_URL" >/dev/null
  wait_ready
}

write_canvas_rect_from_assertion() {
  local assertion_name="$1"
  local rect_name="$2"
  node - "$EVIDENCE_DIR/assert-${assertion_name}.stdout" "$EVIDENCE_DIR/${rect_name}.rect.json" <<'NODE'
const fs = require("fs")
const source = fs.readFileSync(process.argv[2], "utf8")
const first = source.indexOf("{")
const last = source.lastIndexOf("}")
if (first === -1 || last === -1) throw new Error(`no JSON object in ${process.argv[2]}`)
const value = JSON.parse(source.slice(first, last + 1))
if (!value.canvas) throw new Error(`assertion ${process.argv[2]} did not include a canvas rect`)
fs.writeFileSync(process.argv[3], `${JSON.stringify(value.canvas, null, 2)}\n`)
NODE
}

assert_canvas_screenshot_nonblank() {
  local name="$1"
  local image="$2"
  local rect="$3"
  local stdout_file="$EVIDENCE_DIR/assert-${name}.stdout"
  local stderr_file="$EVIDENCE_DIR/assert-${name}.stderr"
  if node - "$image" "$rect" >"$stdout_file" 2>"$stderr_file" <<'NODE'
const fs = require("fs")
const sharp = require("sharp")
const [imagePath, rectPath] = process.argv.slice(2)
;(async () => {
  const rect = JSON.parse(fs.readFileSync(rectPath, "utf8"))
  const meta = await sharp(imagePath).metadata()
  const left = Math.max(0, Math.min(meta.width - 1, rect.x))
  const top = Math.max(0, Math.min(meta.height - 1, rect.y))
  const width = Math.max(1, Math.min(meta.width - left, rect.width))
  const height = Math.max(1, Math.min(meta.height - top, rect.height))
  const { data, info } = await sharp(imagePath)
    .extract({ left, top, width, height })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const channels = info.channels
  const unique = new Set()
  let nonBackground = 0
  for (let i = 0; i < data.length; i += channels) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`
    unique.add(key)
    const colorDistance =
      Math.abs(data[i] - 7) + Math.abs(data[i + 1] - 25) + Math.abs(data[i + 2] - 27)
    if (colorDistance > 18) nonBackground += 1
  }
  if (unique.size < 8 || nonBackground < 64) {
    throw new Error(
      `canvas crop appears blank: unique=${unique.size}, nonBackground=${nonBackground}, crop=${width}x${height}`,
    )
  }
  console.log(
    JSON.stringify({ ok: true, uniqueColors: unique.size, nonBackground, crop: { left, top, width, height } }),
  )
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
NODE
  then
    append_assertion "$name" "passed" "$stdout_file"
  else
    append_assertion "$name" "failed" "$stderr_file"
    fail "$name"
  fi
}

assert_static_build_contract() {
  local name="$1"
  assert_eval "$name" <<'JS'
const atlas = document.querySelector('[data-testid="memory-atlas"]')
if (!atlas) throw new Error("Memory Atlas root is missing from home")
const title = document.body.innerText.includes("기억의 항해도")
if (!title) throw new Error("Memory Atlas title is missing from home")
const graph = document.querySelector(".graph-container")
if (graph) throw new Error("legacy local graph should not render beside Memory Atlas")
const knowledgeMeta = document.querySelector(".knowledge-meta")
if (knowledgeMeta) throw new Error("KnowledgeMeta should not appear on the home Memory Atlas page")
const canvas = document.querySelector('[data-testid="memory-atlas-canvas"] canvas')
if (!canvas) throw new Error("WebGL canvas is missing from home")
const rect = canvas.getBoundingClientRect()
if (rect.width <= 0 || rect.height <= 0) throw new Error(`invalid canvas size ${rect.width}x${rect.height}`)
return ({
  ok: true,
  hasAtlas: Boolean(atlas),
  hasLegacyGraph: Boolean(graph),
  canvas: {
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  },
})
JS
}

assert_ssr_home_shell() {
  local name="$1"
  local stdout_file="$EVIDENCE_DIR/assert-${name}.stdout"
  local stderr_file="$EVIDENCE_DIR/assert-${name}.stderr"
  if curl -fsS "$BASE_URL/" >"$EVIDENCE_DIR/home-ssr.html" 2>"$stderr_file" &&
    grep -Eq '<body[^>]*class="memory-atlas-page"' "$EVIDENCE_DIR/home-ssr.html"; then
    printf '{"ok":true,"class":"memory-atlas-page"}\n' >"$stdout_file"
    append_assertion "$name" "passed" "$stdout_file"
  else
    append_assertion "$name" "failed" "$stderr_file"
    fail "$name"
  fi
}

assert_mobile_ready_canvas() {
  local name="$1"
  assert_eval "$name" <<'JS'
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  throw new Error("reduced motion media query is not active")
}
if (!matchMedia("(prefers-color-scheme: dark)").matches) {
  throw new Error("dark color scheme media query is not active")
}
const root = document.querySelector('[data-testid="memory-atlas"]')
if (!root) throw new Error("Memory Atlas root is missing")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const canvas = document.querySelector('[data-testid="memory-atlas-canvas"] canvas')
if (!canvas) throw new Error("mobile WebGL canvas is missing")
const rect = canvas.getBoundingClientRect()
if (rect.width <= 0 || rect.height <= 0) throw new Error(`invalid mobile canvas size ${rect.width}x${rect.height}`)
return ({
  ok: true,
  reducedMotion: true,
  dark: true,
  canvas: {
    x: Math.max(0, Math.floor(rect.x)),
    y: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  },
})
JS
}

assert_viewport_horizontal_contract() {
  local name="$1"
  local width="$2"
  local height="$3"
  assert_eval "$name" <<JS
const viewport = { width: window.innerWidth, height: window.innerHeight }
if (viewport.width !== $width || viewport.height !== $height) {
  throw new Error(\`expected viewport ${width}x${height}, got \${viewport.width}x\${viewport.height}\`)
}
const documentOverflow = Math.max(
  document.documentElement.scrollWidth,
  document.body?.scrollWidth ?? 0,
) - document.documentElement.clientWidth
if (documentOverflow > 1) {
  throw new Error(\`document horizontal overflow \${documentOverflow}px\`)
}
const isRendered = (element) => {
  if (element.hidden || element.closest("[hidden]")) return false
  const style = getComputedStyle(element)
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false
  }
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  if (rect.right <= 0 || rect.left >= viewport.width) return false
  if (rect.bottom <= 0 || rect.top >= viewport.height) return false
  return true
}
const violations = [...document.body.querySelectorAll("*")]
  .filter(isRendered)
  .map((element) => {
    const rect = element.getBoundingClientRect()
    return {
      tag: element.tagName.toLowerCase(),
      testid: element.getAttribute("data-testid"),
      className: typeof element.className === "string" ? element.className : "",
      left: Number(rect.left.toFixed(2)),
      right: Number(rect.right.toFixed(2)),
      width: Number(rect.width.toFixed(2)),
    }
  })
  .filter((entry) => entry.left < -1 || entry.right > viewport.width + 1)
if (violations.length > 0) {
  throw new Error(\`visible elements exceed viewport horizontally: \${JSON.stringify(violations.slice(0, 8))}\`)
}
const canvas = document.querySelector('[data-testid="memory-atlas-canvas"] canvas')
if (canvas) {
  const rect = canvas.getBoundingClientRect()
  if (rect.left < -1 || rect.right > viewport.width + 1) {
    throw new Error(\`canvas exceeds viewport horizontally: left=\${rect.left}, right=\${rect.right}, viewport=\${viewport.width}\`)
  }
}
return ({ ok: true, viewport, documentOverflow, violations: violations.length })
JS
}

assert_canvas_fills_primary_viewport() {
  local name="$1"
  assert_eval "$name" <<'JS'
const root = document.querySelector('[data-testid="memory-atlas"]')
if (!root) throw new Error("Memory Atlas root is missing")
const stage = document.querySelector(".memory-atlas__stage")
const topbar = document.querySelector(".memory-atlas__topbar")
const canvasRegion = document.querySelector('[data-testid="memory-atlas-canvas"]')
const canvas = canvasRegion?.querySelector("canvas")
if (!stage || !topbar || !canvasRegion || !canvas) {
  throw new Error("primary stage, topbar, canvas region, or WebGL canvas is missing")
}
const rootRect = root.getBoundingClientRect()
const stageRect = stage.getBoundingClientRect()
const topbarRect = topbar.getBoundingClientRect()
const regionRect = canvasRegion.getBoundingClientRect()
const canvasRect = canvas.getBoundingClientRect()
const expectedMinHeight = Math.max(320, rootRect.height - topbarRect.height - 96)
if (regionRect.height < expectedMinHeight) {
  throw new Error(
    `canvas region is squeezed: region=${regionRect.height}, expected>=${expectedMinHeight}, root=${rootRect.height}, topbar=${topbarRect.height}`,
  )
}
if (canvasRect.width < stageRect.width - 2) {
  throw new Error(`canvas width ${canvasRect.width} does not fill stage width ${stageRect.width}`)
}
if (canvasRect.height < regionRect.height - 2) {
  throw new Error(`canvas height ${canvasRect.height} does not fill canvas region ${regionRect.height}`)
}
return ({
  ok: true,
  root: { width: rootRect.width, height: rootRect.height },
  stage: { width: stageRect.width, height: stageRect.height },
  canvasRegion: { width: regionRect.width, height: regionRect.height },
  canvas: { width: canvasRect.width, height: canvasRect.height },
})
JS
}

assert_results_default_collapsed_and_search_usable() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 60; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const visibleBox = (element) => {
  if (element.hidden || element.closest("[hidden]")) return false
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const section = document.querySelector(".memory-atlas__results")
const list = byTestId("memory-atlas-results")
if (!section) throw new Error("results section is missing")
const defaultRect = section.getBoundingClientRect()
const defaultCollapsed =
  section.hidden ||
  section.getAttribute("aria-hidden") === "true" ||
  defaultRect.height <= 72 ||
  getComputedStyle(section).display === "none"
if (!defaultCollapsed) {
  throw new Error(`results must be hidden or collapsed by default, height=${defaultRect.height}`)
}
const seed = [...list.querySelectorAll("button, a")]
  .map((element) => element.textContent?.trim().split(/\s+/)[0])
  .find(Boolean)
if (!seed) throw new Error("results list has no searchable seed item")
const search = byTestId("memory-atlas-search")
search.value = seed
search.dispatchEvent(new Event("input", { bubbles: true }))
await waitFor(() => {
  const controls = [...list.querySelectorAll("button, a")]
  return visibleBox(section) && controls.some((control) => visibleBox(control))
}, "results to become usable after search")
const usableControls = [...list.querySelectorAll("button, a")].filter(visibleBox)
usableControls[0].focus()
if (document.activeElement !== usableControls[0]) {
  throw new Error("first visible result cannot receive focus")
}
return ({
  ok: true,
  defaultHeight: defaultRect.height,
  seed,
  usableControls: usableControls.length,
})
JS
}

assert_desktop_type_filter() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 50; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const visible = (element) => !element.hidden && getComputedStyle(element).display !== "none"
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const nodeCount = () => Number(byTestId("memory-atlas-node-count").textContent)
const resultButtons = () => [...document.querySelectorAll('[data-testid="memory-atlas-results"] button')]
const initialCount = nodeCount()
if (initialCount <= 1) throw new Error(`expected multiple nodes, got ${initialCount}`)

const type = document.querySelector('input[name="memory-atlas-type"][value="topic"]')
if (!type) throw new Error("topic type checkbox is missing")
type.checked = false
type.dispatchEvent(new Event("change", { bubbles: true }))
await waitFor(() => nodeCount() < initialCount, "type filter to reduce node count")
const typeFilteredCount = nodeCount()

type.checked = true
type.dispatchEvent(new Event("change", { bubbles: true }))
await waitFor(() => nodeCount() === initialCount, "type filter reset to initial count")
return ({ ok: true, initialCount, typeFilteredCount })
JS
}

assert_desktop_layout_color() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)

const layout = byTestId("memory-atlas-layout")
layout.value = "cluster"
layout.dispatchEvent(new Event("change", { bubbles: true }))
await sleep(150)
if (layout.value !== "cluster") throw new Error("layout select did not keep cluster value")

const color = byTestId("memory-atlas-color")
color.value = "freshness"
color.dispatchEvent(new Event("change", { bubbles: true }))
await sleep(150)
if (color.value !== "freshness") throw new Error("color select did not keep freshness value")
return ({ ok: true, layout: layout.value, color: color.value })
JS
}

assert_desktop_reset_overflow() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 50; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const visible = (element) => !element.hidden && getComputedStyle(element).display !== "none"
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const nodeCount = () => Number(byTestId("memory-atlas-node-count").textContent)
const initialCount = nodeCount()
const search = byTestId("memory-atlas-search")
search.value = "__memory_atlas_no_results__"
search.dispatchEvent(new Event("input", { bubbles: true }))
await waitFor(() => nodeCount() === 0 && visible(byTestId("memory-atlas-empty")), "empty state")
byTestId("memory-atlas-reset").click()
await waitFor(() => nodeCount() === initialCount && search.value === "", "reset to initial state")
const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
if (overflow > 1) throw new Error(`desktop horizontal overflow ${overflow}px`)
return ({ ok: true, initialCount, overflow })
JS
}

assert_desktop_detail_selection() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 50; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}

const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const nodeCount = () => Number(byTestId("memory-atlas-node-count").textContent)
const resultButtons = () => [...document.querySelectorAll('[data-testid="memory-atlas-results"] button')]
const initialCount = nodeCount()
if (initialCount <= 1) throw new Error(`expected multiple nodes, got ${initialCount}`)
const seed = resultButtons().map((button) => button.textContent.trim().split(/\s+/)[0]).find(Boolean)
if (!seed) throw new Error("no result seed is available for detail selection")
const search = byTestId("memory-atlas-search")
search.value = seed
search.dispatchEvent(new Event("input", { bubbles: true }))
await waitFor(() => resultButtons().length > 0, "search results for detail selection")
const selectedTitle = resultButtons()[0].textContent.trim()
resultButtons()[0].click()
await waitFor(() => root.classList.contains("memory-atlas--detail-open"), "detail panel to open")
const detailTitle = byTestId("memory-atlas-detail-title").textContent.trim()
if (detailTitle !== selectedTitle) {
  throw new Error(`detail title "${detailTitle}" did not match selected "${selectedTitle}"`)
}
const detailHref = byTestId("memory-atlas-detail-link").href
if (!detailHref || detailHref.endsWith("#")) throw new Error("detail source link did not resolve")
const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
if (overflow > 1) throw new Error(`desktop horizontal overflow ${overflow}px`)
return ({
  ok: true,
  initialCount,
  selectedTitle,
  detailHref,
  overflow,
})
JS
}

assert_desktop_label_hierarchy() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 50; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
const canvas = byTestId("memory-atlas-canvas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const nodeCount = Number(byTestId("memory-atlas-node-count").textContent)
await waitFor(() => Number(canvas.dataset.labelCount) === nodeCount, "all passive node labels")
const initialTextureTemplateCount = Number(canvas.dataset.labelTextureTemplateCount)
if (Number(canvas.dataset.passiveLabelCount) !== nodeCount) {
  throw new Error(`expected ${nodeCount} passive labels, got ${canvas.dataset.passiveLabelCount}`)
}
if (canvas.dataset.labelStyleMismatchCount !== "0") {
  throw new Error(`passive label material mismatch: ${canvas.dataset.labelStyleMismatchCount}`)
}
if (canvas.dataset.staleLinkEndpointCount !== "0") {
  throw new Error(`initial graph has stale link endpoints: ${canvas.dataset.staleLinkEndpointCount}`)
}
const connectedItem = [...document.querySelectorAll('[data-testid="memory-atlas-results"] li')]
  .find((item) => Number(item.dataset.degree) > 0)
if (!connectedItem) throw new Error("no connected node is available for label hierarchy")
connectedItem.querySelector("button")?.click()
await waitFor(() => Number(canvas.dataset.connectedLabelCount) > 0, "connected node labels")
const selected = Number(canvas.dataset.selectedLabelCount)
const connected = Number(canvas.dataset.connectedLabelCount)
const dimmed = Number(canvas.dataset.dimmedLabelCount)
const total = Number(canvas.dataset.labelCount)
const highlightedNodes = Number(canvas.dataset.highlightedNodeCount)
const mutedNodes = Number(canvas.dataset.mutedNodeCount)
const selectedTextureTemplateCount = Number(canvas.dataset.labelTextureTemplateCount)
if (selected !== 1) throw new Error(`expected one selected label, got ${selected}`)
if (total !== nodeCount) throw new Error(`selection changed label total: ${total} !== ${nodeCount}`)
if (selected + connected + dimmed !== total) {
  throw new Error(`label tone counts do not add up: ${selected} + ${connected} + ${dimmed} !== ${total}`)
}
if (highlightedNodes !== selected + connected || mutedNodes !== dimmed) {
  throw new Error(`node emphasis did not match 1-hop labels: highlighted=${highlightedNodes}, muted=${mutedNodes}`)
}
if (canvas.dataset.labelStyleMismatchCount !== "0") {
  throw new Error(`selected label material mismatch: ${canvas.dataset.labelStyleMismatchCount}`)
}
if (canvas.dataset.staleLinkEndpointCount !== "0") {
  throw new Error(`selected graph has stale link endpoints: ${canvas.dataset.staleLinkEndpointCount}`)
}
if (selectedTextureTemplateCount !== initialTextureTemplateCount) {
  throw new Error(`selection recreated label texture templates: ${initialTextureTemplateCount} -> ${selectedTextureTemplateCount}`)
}
const labelsToggle = byTestId("memory-atlas-labels")
labelsToggle.click()
await waitFor(() => canvas.dataset.labelCount === "0", "label toggle off")
labelsToggle.click()
await waitFor(() => Number(canvas.dataset.labelCount) === nodeCount, "label toggle restore")
return ({
  ok: true,
  nodeCount,
  selected,
  connected,
  dimmed,
  highlightedNodes,
  mutedNodes,
  labelTextureTemplateCount: selectedTextureTemplateCount,
})
JS
}

assert_brain_ask_ui_contract() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 80; i++) {
    const value = predicate()
    if (value) return value
    await sleep(50)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const firstSlug = document.querySelector('[data-testid="memory-atlas-results"] li')?.dataset.slug
if (!firstSlug) throw new Error("no content slug is available for ask source validation")
const originalFetch = window.fetch.bind(window)
const storageEvents = []
const originalSetItem = Storage.prototype.setItem
Storage.prototype.setItem = function patchedSetItem(key, value) {
  storageEvents.push({ key: String(key), value: String(value) })
  return originalSetItem.call(this, key, value)
}
let mode = "success"
let calls = 0
window.fetch = async (input, init) => {
  const url = String(input)
  if (!url.endsWith("/api/brain/ask")) return originalFetch(input, init)
  calls += 1
  const request = JSON.parse(String(init?.body ?? "{}"))
  if (request.question !== "근거 질문") throw new Error(`unexpected question body: ${init?.body}`)
  await sleep(120)
  if (init?.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" })
  if (mode === "empty") {
    return new Response(JSON.stringify({ requestId: "empty", answer: "", sources: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  if (mode === "error") {
    return new Response(
      JSON.stringify({
        requestId: "err",
        error: { code: "model_timeout", message: "timeout", retryable: true },
      }),
      { status: 504, headers: { "content-type": "application/json" } },
    )
  }
  return new Response(
    JSON.stringify({
      requestId: "ok",
      answer: "<strong>HTML이 아닌 평문</strong>",
      sources: [
        {
          title: "공개 근거",
          slug: firstSlug,
          namespace: "public",
          score: 0.91,
          excerpt: "공개 발췌",
          href: `/${firstSlug}`,
        },
        {
          title: "외부 링크",
          slug: "outside",
          namespace: "public",
          score: 0.1,
          excerpt: "거부",
          href: "https://example.invalid/outside",
        },
        {
          title: "없는 private",
          slug: "entities/private",
          namespace: "private",
          score: 0.2,
          excerpt: "현재 색인에 없음",
          href: "/_private/entities/private",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )
}
try {
  byTestId("memory-atlas-ask-toggle").click()
  const panel = byTestId("memory-atlas-ask-panel")
  if (panel.hidden) throw new Error("ask panel did not open")
  if (document.activeElement !== byTestId("memory-atlas-ask-question")) {
    throw new Error("question textarea did not receive focus")
  }
  const question = byTestId("memory-atlas-ask-question")
  question.value = "근거 질문"
  question.dispatchEvent(new Event("input", { bubbles: true }))
  if (!byTestId("memory-atlas-ask-count").textContent.includes("5 / 500")) {
    throw new Error("question counter did not update")
  }
  byTestId("memory-atlas-ask-submit").click()
  await waitFor(() => root.dataset.askState === "retrieving", "retrieving state")
  await waitFor(() => root.dataset.askState === "generating", "generating state")
  byTestId("memory-atlas-ask-submit").click()
  await waitFor(() => root.dataset.askState === "success", "success state")
  if (calls !== 1) throw new Error(`duplicate submit was not blocked: calls=${calls}`)
  const answerText = byTestId("memory-atlas-ask-answer-text")
  if (answerText.textContent !== "<strong>HTML이 아닌 평문</strong>") {
    throw new Error(`answer was not rendered as textContent: ${answerText.textContent}`)
  }
  if (answerText.querySelector("strong")) throw new Error("answer HTML was interpreted")
  const sources = [...document.querySelectorAll('[data-testid="memory-atlas-ask-source-list"] li')]
  if (sources.length !== 1) throw new Error(`expected only one valid same-origin source, got ${sources.length}`)
  if (byTestId("memory-atlas-canvas").dataset.evidenceCount !== "1") {
    throw new Error("evidence highlight was not created")
  }
  const storageLeak = storageEvents.find((event) =>
    event.value.includes("근거 질문") || event.value.includes("HTML이 아닌 평문") || event.value.includes("공개 발췌"),
  )
  if (storageLeak) throw new Error(`question data reached storage: ${JSON.stringify(storageLeak)}`)
  if (location.href.includes("근거")) throw new Error("question leaked into URL")

  document.querySelector('[data-testid="memory-atlas-results"] button')?.click()
  await waitFor(() => byTestId("memory-atlas-canvas").dataset.evidenceCount === "0", "evidence clear on node selection")

  mode = "empty"
  question.value = "근거 질문"
  question.dispatchEvent(new Event("input", { bubbles: true }))
  byTestId("memory-atlas-ask-submit").click()
  await waitFor(() => root.dataset.askState === "empty", "empty state")
  if (byTestId("memory-atlas-canvas").dataset.evidenceCount !== "0") {
    throw new Error("empty result did not clear evidence highlight")
  }

  mode = "error"
  question.value = "근거 질문"
  question.dispatchEvent(new Event("input", { bubbles: true }))
  byTestId("memory-atlas-ask-submit").click()
  await waitFor(() => root.dataset.askState === "error", "error state")
  if (byTestId("memory-atlas-ask-retry").hidden) throw new Error("retry button was not shown")
  if (byTestId("memory-atlas-canvas").dataset.evidenceCount !== "0") {
    throw new Error("error result did not clear evidence highlight")
  }

  byTestId("memory-atlas-ask-close").click()
  await waitFor(() => panel.hidden, "ask panel close")
  if (byTestId("memory-atlas-ask-answer-text").textContent) throw new Error("answer text remained after close")
  if (byTestId("memory-atlas-ask-source-list").children.length) throw new Error("sources remained after close")
  if (byTestId("memory-atlas-canvas").dataset.evidenceCount !== "0") {
    throw new Error("close did not clear evidence highlight")
  }
  const callsAfterClose = calls
  byTestId("memory-atlas-ask-toggle").click()
  await waitFor(() => !panel.hidden, "ask panel reopen")
  if (question.value) throw new Error("question textarea retained value after close")
  byTestId("memory-atlas-ask-retry").click()
  await sleep(180)
  if (calls !== callsAfterClose) throw new Error("retry reused closed question from closure")
  if (question.value) throw new Error("last question was restored after close")
  return ({ ok: true, calls, storageEvents: storageEvents.length, sourceSlug: firstSlug })
} finally {
  window.fetch = originalFetch
  Storage.prototype.setItem = originalSetItem
}
JS
}

assert_brain_ask_abort_and_escape() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 80; i++) {
    const value = predicate()
    if (value) return value
    await sleep(50)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const originalFetch = window.fetch.bind(window)
let aborted = false
window.fetch = async (input, init) => {
  if (!String(input).endsWith("/api/brain/ask")) return originalFetch(input, init)
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
    })
  })
}
try {
  byTestId("memory-atlas-ask-toggle").click()
  const panel = byTestId("memory-atlas-ask-panel")
  const question = byTestId("memory-atlas-ask-question")
  question.value = "근거 질문"
  question.dispatchEvent(new Event("input", { bubbles: true }))
  byTestId("memory-atlas-ask-submit").click()
  await waitFor(() => byTestId("memory-atlas").dataset.askState === "retrieving", "pending ask")
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
  await waitFor(() => panel.hidden && aborted, "escape abort and close")
  if (byTestId("memory-atlas-canvas").dataset.evidenceCount === "1") {
    throw new Error("aborted request left evidence highlight")
  }
  return ({ ok: true, aborted })
} finally {
  window.fetch = originalFetch
}
JS
}

assert_mobile_ask_sheet_focus() {
  local name="$1"
  assert_eval "$name" <<'JS'
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
byTestId("memory-atlas-ask-toggle").click()
const panel = byTestId("memory-atlas-ask-panel")
if (panel.hidden) throw new Error("mobile ask panel did not open")
const rect = panel.getBoundingClientRect()
if (rect.left < -1 || rect.right > window.innerWidth + 1) {
  throw new Error(`mobile ask panel exceeds viewport: ${rect.left}..${rect.right}`)
}
if (rect.height > window.innerHeight * 0.68) {
  throw new Error(`mobile ask panel is too tall: ${rect.height}`)
}
const textarea = byTestId("memory-atlas-ask-question")
textarea.focus()
const close = byTestId("memory-atlas-ask-close")
const submit = byTestId("memory-atlas-ask-submit")
close.focus()
close.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }))
if (document.activeElement !== submit) throw new Error("focus trap did not wrap backward to submit")
submit.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
if (document.activeElement !== close) throw new Error("focus trap did not wrap forward to close")
byTestId("memory-atlas-ask-close").click()
return ({ ok: true, panel: { left: rect.left, right: rect.right, height: rect.height } })
JS
}

assert_home_network_once() {
  local name="$1"
  local stdout_file="$EVIDENCE_DIR/assert-${name}.stdout"
  local stderr_file="$EVIDENCE_DIR/assert-${name}.stderr"
  if node - "$EVIDENCE_DIR/network-home.json" >"$stdout_file" 2>"$stderr_file" <<'NODE'
const fs = require("fs")
const path = process.argv[2]
const text = fs.readFileSync(path, "utf8")
let value
try {
  value = JSON.parse(text)
} catch {
  value = text
}
const strings = []
const visit = (item) => {
  if (typeof item === "string") strings.push(item)
  else if (Array.isArray(item)) item.forEach(visit)
  else if (item && typeof item === "object") Object.values(item).forEach(visit)
}
visit(value)
const matches = strings.filter((entry) => /\/static\/memory-atlas\.js(?:$|[?#])/.test(entry))
if (matches.length !== 1) {
  console.error(`expected /static/memory-atlas.js once on home, found ${matches.length}`)
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, memoryAtlasRequests: matches.length }))
NODE
  then
    append_assertion "$name" "passed" "$stdout_file"
  else
    append_assertion "$name" "failed" "$stderr_file"
    fail "$name"
  fi
}

assert_doc_navigation_contract() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 60; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const list = document.querySelector('[data-testid="memory-atlas-results"]')
if (!list) throw new Error("results list is missing before document navigation")
const seed = [...list.querySelectorAll("button, a")]
  .map((element) => element.textContent?.trim().split(/\s+/)[0])
  .find(Boolean)
if (!seed) throw new Error("no result seed is available before document navigation")
const search = document.querySelector('[data-testid="memory-atlas-search"]')
if (!search) throw new Error("search input is missing before document navigation")
search.value = seed
search.dispatchEvent(new Event("input", { bubbles: true }))
await waitFor(() => document.querySelector('[data-testid="memory-atlas-results"] button'), "search-backed result button")
const button = document.querySelector('[data-testid="memory-atlas-results"] button')
if (!button) throw new Error("result button is missing before document navigation")
button.click()
await new Promise((resolve) => setTimeout(resolve, 100))
const link = document.querySelector('[data-testid="memory-atlas-detail-link"]')
if (!link) throw new Error("detail source link is missing")
const href = link.href
if (!href || new URL(href).origin !== window.location.origin) {
  throw new Error(`detail source link is invalid: ${href}`)
}
return ({ ok: true, href })
JS
  ab click '[data-testid="memory-atlas-detail-link"]' >/dev/null
  ab wait --fn "!document.querySelector('[data-testid=\"memory-atlas\"]') && document.body.classList.contains('memory-atlas-doc-page') && document.querySelector('.knowledge-meta') && document.querySelector('.memory-atlas-doc-return')" >/dev/null
  capture_network "doc"
  capture_errors "doc"
  assert_eval "${name}-after-navigation" <<'JS'
const atlas = document.querySelector('[data-testid="memory-atlas"]')
if (atlas) throw new Error("Memory Atlas leaked onto a representative concept document")
const meta = document.querySelector(".knowledge-meta")
if (!meta) throw new Error("KnowledgeMeta is missing on representative concept document")
const graph = document.querySelector(".graph-container")
if (graph) throw new Error("legacy local graph should not render in the focused document shell")
const returnLink = document.querySelector(".memory-atlas-doc-return")
if (!returnLink || !returnLink.textContent.includes("항해도로 돌아가기")) {
  throw new Error("document return-to-atlas action is missing")
}
const paragraph = document.querySelector("article p")
if (paragraph) {
  const color = getComputedStyle(paragraph).color.match(/\d+(?:\.\d+)?/g)?.map(Number)
  if (!color || Math.max(...color.slice(0, 3)) < 140) {
    throw new Error(`document body contrast is too low: ${getComputedStyle(paragraph).color}`)
  }
}
const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
if (overflow > 1) throw new Error(`document horizontal overflow ${overflow}px`)
return ({ ok: true, url: location.href, overflow, legacyGraphAbsent: true })
JS
  local stdout_file="$EVIDENCE_DIR/assert-${name}-network.stdout"
  local stderr_file="$EVIDENCE_DIR/assert-${name}-network.stderr"
  if node - "$EVIDENCE_DIR/network-doc.json" >"$stdout_file" 2>"$stderr_file" <<'NODE'
const fs = require("fs")
const text = fs.readFileSync(process.argv[2], "utf8")
let value
try {
  value = JSON.parse(text)
} catch {
  value = text
}
const strings = []
const visit = (item) => {
  if (typeof item === "string") strings.push(item)
  else if (Array.isArray(item)) item.forEach(visit)
  else if (item && typeof item === "object") Object.values(item).forEach(visit)
}
visit(value)
const matches = strings.filter((entry) => /\/static\/memory-atlas\.js(?:$|[?#])/.test(entry))
if (matches.length !== 0) {
  console.error(`expected /static/memory-atlas.js zero times on doc navigation, found ${matches.length}`)
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, memoryAtlasRequests: matches.length }))
NODE
  then
    append_assertion "${name}-network" "passed" "$stdout_file"
  else
    append_assertion "${name}-network" "failed" "$stderr_file"
    fail "${name}-network"
  fi

  ab click '.memory-atlas-doc-return' >/dev/null
  wait_ready
  assert_eval "${name}-restored-selection" <<'JS'
const root = document.querySelector('[data-testid="memory-atlas"]')
if (!root?.classList.contains("memory-atlas--detail-open")) {
  throw new Error("returning from a document did not restore its selected node")
}
const close = document.querySelector('[data-testid="memory-atlas-detail-close"]')
if (!close) throw new Error("detail close control is missing after return")
close.click()
await new Promise((resolve) => setTimeout(resolve, 100))
const stored = JSON.parse(sessionStorage.getItem("memoryAtlasState") ?? "{}")
if (stored.selectedSlug) throw new Error(`cleared selection remained persisted: ${stored.selectedSlug}`)
return ({ ok: true, selectedSlug: stored.selectedSlug ?? null })
JS
  ab open "$BASE_URL" >/dev/null
  wait_ready
  assert_eval "${name}-cleared-selection-stays-cleared" <<'JS'
const root = document.querySelector('[data-testid="memory-atlas"]')
if (root?.classList.contains("memory-atlas--detail-open")) {
  throw new Error("a cleared selection was revived after returning to the atlas")
}
const stored = JSON.parse(sessionStorage.getItem("memoryAtlasState") ?? "{}")
if (stored.selectedSlug) throw new Error(`stale selected slug was restored: ${stored.selectedSlug}`)
return ({ ok: true, selectedSlug: null })
JS
}

assert_mobile_drawer_touch() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 80; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  throw new Error("reduced motion media query is not active")
}
if (!matchMedia("(prefers-color-scheme: dark)").matches) {
  throw new Error("dark color scheme media query is not active")
}
const overflowBefore = document.documentElement.scrollWidth - document.documentElement.clientWidth
if (overflowBefore > 1) throw new Error(`mobile horizontal overflow before interactions ${overflowBefore}px`)
const toggle = byTestId("memory-atlas-filter-toggle")
const toggleBox = toggle.getBoundingClientRect()
if (toggleBox.width < 44 || toggleBox.height < 44) {
  throw new Error(`filter toggle touch target is ${toggleBox.width}x${toggleBox.height}`)
}
toggle.click()
await waitFor(() => root.classList.contains("memory-atlas--filters-open"), "filter drawer open")
if (toggle.getAttribute("aria-expanded") !== "true") throw new Error("filter toggle aria-expanded did not become true")
byTestId("memory-atlas-backdrop").click()
await waitFor(() => !root.classList.contains("memory-atlas--filters-open"), "filter drawer close")
return ({ ok: true, overflowBefore, touchTarget: { width: toggleBox.width, height: toggleBox.height } })
JS
}

assert_mobile_keyboard_focus() {
  local name="$1"
  assert_eval "$name" <<'JS'
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const search = byTestId("memory-atlas-search")
search.focus()
if (document.activeElement !== search) throw new Error("search input did not receive keyboard focus")
return ({ ok: true, activeTestId: document.activeElement?.dataset?.testid ?? "" })
JS
}

assert_mobile_detail_sheet() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 50; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
const button = document.querySelector('[data-testid="memory-atlas-results"] button')
const seed = button?.textContent?.trim().split(/\s+/)[0]
if (!seed) throw new Error("mobile result seed is missing")
const search = byTestId("memory-atlas-search")
search.value = seed
search.dispatchEvent(new Event("input", { bubbles: true }))
await waitFor(() => document.querySelector('[data-testid="memory-atlas-results"] button'), "mobile search results")
const nextButton = document.querySelector('[data-testid="memory-atlas-results"] button')
if (!nextButton) throw new Error("mobile result button is missing")
nextButton.click()
await waitFor(() => root.classList.contains("memory-atlas--detail-open"), "mobile detail sheet open")
const close = byTestId("memory-atlas-detail-close")
const closeBox = close.getBoundingClientRect()
if (closeBox.width < 44 || closeBox.height < 44) {
  throw new Error(`detail close touch target is ${closeBox.width}x${closeBox.height}`)
}
close.click()
await waitFor(() => !root.classList.contains("memory-atlas--detail-open"), "mobile detail sheet close")
const overflowAfter = document.documentElement.scrollWidth - document.documentElement.clientWidth
if (overflowAfter > 1) throw new Error(`mobile horizontal overflow after interactions ${overflowAfter}px`)
return ({ ok: true, overflowAfter, closeTarget: { width: closeBox.width, height: closeBox.height } })
JS
}

assert_mobile_canvas_context() {
  local name="$1"
  assert_eval "$name" <<'JS'
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime state is ${root.dataset.runtimeState}`)
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  throw new Error("reduced motion media query is not active")
}
const canvas = byTestId("memory-atlas-canvas").querySelector("canvas")
if (!canvas) throw new Error("mobile WebGL canvas is missing")
const canvasRect = canvas.getBoundingClientRect()
if (canvasRect.width <= 0 || canvasRect.height <= 0) {
  throw new Error(`invalid mobile canvas size ${canvasRect.width}x${canvasRect.height}`)
}
const gl = canvas.getContext("webgl2") || canvas.getContext("webgl")
if (!gl) throw new Error("mobile WebGL context is unavailable")
return ({
  ok: true,
  reducedMotion: true,
  canvas: {
    x: Math.max(0, Math.floor(canvasRect.x)),
    y: Math.max(0, Math.floor(canvasRect.y)),
    width: Math.max(1, Math.floor(canvasRect.width)),
    height: Math.max(1, Math.floor(canvasRect.height)),
  },
})
JS
}

assert_content_index_fallback() {
  local name="$1"
  assert_eval "$name" <<'JS'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (predicate, label) => {
  for (let i = 0; i < 80; i++) {
    const value = predicate()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}`)
}
const byTestId = (id) => {
  const element = document.querySelector(`[data-testid="${id}"]`)
  if (!element) throw new Error(`${id} not found`)
  return element
}
const root = byTestId("memory-atlas")
await waitFor(() => root.dataset.runtimeState === "error", "runtime error after aborted content index")
const error = byTestId("memory-atlas-error")
if (error.hidden) throw new Error("error panel is hidden after content index abort")
const message = byTestId("memory-atlas-error-message").textContent.trim()
if (!message) throw new Error("error message is empty")
const retry = byTestId("memory-atlas-retry")
if (retry.hidden) throw new Error("retry button is hidden")
const fallbackItems = document.querySelectorAll('[data-testid="memory-atlas-results"] li')
if (fallbackItems.length <= 0) throw new Error("static fallback document list is empty")
retry.click()
await waitFor(() => root.dataset.runtimeState === "error", "retry to preserve error while route is aborted")
return ({ ok: true, message, fallbackItems: fallbackItems.length })
JS
}

run_with_timeout 10 agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
rotate_namespace "desktop-static"
open_desktop_home
assert_ssr_home_shell "home-ssr-shell-before-runtime"
assert_static_build_contract "desktop-static-build-contract"
assert_viewport_horizontal_contract "desktop-visible-elements-fit-1440x1000" 1440 1000
assert_canvas_fills_primary_viewport "desktop-canvas-fills-primary-viewport"
assert_results_default_collapsed_and_search_usable "desktop-results-collapsed-then-search-usable"
write_canvas_rect_from_assertion "desktop-static-build-contract" "desktop-canvas-rect"
capture_screenshot "desktop"
assert_canvas_screenshot_nonblank "desktop-canvas-screenshot-nonblank" "$EVIDENCE_DIR/desktop.png" "$EVIDENCE_DIR/desktop-canvas-rect.rect.json"
capture_snapshot "desktop"

rotate_namespace "desktop-type"
open_desktop_home
assert_desktop_type_filter "desktop-type-filter"

rotate_namespace "desktop-layout"
open_desktop_home
assert_desktop_layout_color "desktop-layout-color"

rotate_namespace "desktop-reset"
open_desktop_home
assert_desktop_reset_overflow "desktop-reset-overflow"

rotate_namespace "desktop-detail"
open_desktop_home
assert_desktop_detail_selection "desktop-detail-selection"

rotate_namespace "desktop-label-hierarchy"
open_desktop_home
assert_desktop_label_hierarchy "desktop-label-hierarchy"
capture_screenshot "desktop-label-hierarchy"

rotate_namespace "desktop-ask"
open_desktop_home
assert_brain_ask_ui_contract "desktop-brain-ask-ui-contract"

rotate_namespace "desktop-ask-abort"
open_desktop_home
assert_brain_ask_abort_and_escape "desktop-brain-ask-abort-escape"

rotate_namespace "home-network"
open_desktop_home
capture_network "home"
capture_errors "desktop"
assert_home_network_once "home-runtime-request-once"

rotate_namespace "doc-navigation"
open_desktop_home
ab network requests --clear >/dev/null
assert_doc_navigation_contract "document-navigation-contract"

rotate_namespace "mobile"
open_mobile_home
assert_mobile_ready_canvas "mobile-ready-canvas"
assert_viewport_horizontal_contract "mobile-visible-elements-fit-390x844" 390 844
assert_canvas_fills_primary_viewport "mobile-canvas-fills-primary-viewport"
assert_results_default_collapsed_and_search_usable "mobile-results-collapsed-then-search-usable"
write_canvas_rect_from_assertion "mobile-ready-canvas" "mobile-canvas-rect"
capture_screenshot "mobile"
assert_canvas_screenshot_nonblank "mobile-canvas-screenshot-nonblank" "$EVIDENCE_DIR/mobile.png" "$EVIDENCE_DIR/mobile-canvas-rect.rect.json"
assert_mobile_canvas_context "mobile-reduced-motion-canvas-context"
capture_snapshot "mobile"
capture_network "mobile"
capture_errors "mobile"

rotate_namespace "mobile-drawer"
open_mobile_home
assert_mobile_drawer_touch "mobile-drawer-touch"

rotate_namespace "mobile-focus"
open_mobile_home
assert_mobile_keyboard_focus "mobile-keyboard-focus"

rotate_namespace "mobile-detail"
open_mobile_home
assert_mobile_detail_sheet "mobile-detail-sheet"

rotate_namespace "mobile-ask"
open_mobile_home
assert_mobile_ask_sheet_focus "mobile-ask-sheet-focus"

rotate_namespace "fallback"
ab network requests --clear >/dev/null
ab errors --clear >/dev/null
ab console --clear >/dev/null
ab network route "$ROUTE_PATTERN" --abort >/dev/null
ROUTE_ACTIVE=1
ab open "$BASE_URL" >/dev/null
assert_content_index_fallback "content-index-abort-fallback"
capture_screenshot "fallback"
capture_snapshot "fallback"
capture_network "fallback"
capture_errors "fallback"
ab network unroute "$ROUTE_PATTERN" >/dev/null
ROUTE_ACTIVE=0
ab reload >/dev/null
wait_ready
assert_eval "content-index-retry-recovers-after-unroute" <<'JS'
const root = document.querySelector('[data-testid="memory-atlas"]')
if (!root) throw new Error("Memory Atlas root is missing after unroute")
if (root.dataset.runtimeState !== "ready") throw new Error(`runtime did not recover after unroute: ${root.dataset.runtimeState}`)
return ({ ok: true, state: root.dataset.runtimeState })
JS

finalize_assertions

if [[ "$FAILURES" -ne 0 ]]; then
  echo "Memory Atlas browser verification failed with $FAILURES assertion failure(s)." >&2
  exit 1
fi

echo "Memory Atlas browser verification passed."
echo "Evidence: $EVIDENCE_DIR"
