#!/usr/bin/env node
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { assertions } from "./memory-atlas-browser-assertions.mjs"

const baseUrl = process.argv[2]?.replace(/\/$/, "")
if (!baseUrl) {
  console.error("usage: verify-memory-atlas-browser.mjs <local-static-server-url>")
  process.exit(2)
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const quartzDir = path.resolve(scriptDir, "..")
const worktree = path.resolve(quartzDir, "..")
const evidenceDir = process.env.MEMORY_ATLAS_VERIFY_LOG_DIR || "/tmp/fos-brain-memory-atlas-suite"
const driver = process.env.BROWSER_DRIVER_BIN || "/Users/nhn/.claude/scripts/browser-driver"
const driverTimeoutMs = Number(process.env.MEMORY_ATLAS_DRIVER_TIMEOUT_MS || 45000)
const env = {
  ...process.env,
  ORCA_WORKTREE: `path:${worktree}`,
}
const browserEvidenceNames = [
  "assertions.json",
  "assertions.jsonl",
  "browser-connection-recovery.txt",
  "console.txt",
  "doctor.txt",
  "driver.txt",
  "errors.txt",
  "close.txt",
  "memory-atlas-1440-390-harness.png",
  "screenshot.stderr",
  "screenshot-fallback.txt",
  "screenshot.stdout",
  "wait-harness-ready.failed.stderr",
  "worktree.txt",
]
let handle = ""
let failures = 0
let recoveredBrowserConnection = false

async function runDriver(args, options = {}) {
  const result = await new Promise((resolve) => {
    const child = spawn(driver, args, {
      env: options.env ?? env,
      cwd: worktree,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let settled = false
    const timeoutMs = options.timeoutMs ?? driverTimeoutMs
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            if (settled) return
            stderr += `browser-driver ${args[0]} timed out after ${timeoutMs}ms\n`
            child.kill("SIGTERM")
            setTimeout(() => {
              if (!settled) child.kill("SIGKILL")
            }, 2000).unref()
          }, timeoutMs)
        : undefined
    timer?.unref()
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    child.on("close", (code) => {
      settled = true
      if (timer) clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
    child.on("error", (error) => {
      settled = true
      if (timer) clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: String(error) })
    })
  })
  if (options.allowFailure) return result
  if (result.code !== 0) {
    throw new Error(`browser-driver ${args[0]} failed\n${result.stderr || result.stdout}`)
  }
  return result
}

async function writeEvidence(name, content) {
  await fs.writeFile(path.join(evidenceDir, name), content)
}

async function assertDriver(name, expression) {
  const result = await runDriver(["js", handle, expression], { allowFailure: true })
  const record = {
    name,
    status: result.code === 0 ? "passed" : "failed",
    output: result.code === 0 ? result.stdout.trim() : result.stderr.trim() || result.stdout.trim(),
  }
  await fs.appendFile(path.join(evidenceDir, "assertions.jsonl"), `${JSON.stringify(record)}\n`)
  await writeEvidence(`assert-${name}.stdout`, result.stdout)
  await writeEvidence(`assert-${name}.stderr`, result.stderr)
  if (result.code !== 0) {
    failures += 1
    console.error(`FAIL ${name}: ${record.output}`)
  }
}

async function captureScreenshot(driverName) {
  const result = await runDriver(
    ["shot", handle, path.join(evidenceDir, "memory-atlas-1440-390-harness.png")],
    { allowFailure: true },
  )
  await writeEvidence("screenshot.stdout", result.stdout)
  await writeEvidence("screenshot.stderr", result.stderr)
  if (result.code === 0) return

  if (driverName === "orca") {
    const fallbackEnv = { ...env, BROWSER_DRIVER: "agent-browser" }
    let fallbackHandle = ""
    try {
      const fallbackDriver = await runDriver(["driver"], { env: fallbackEnv })
      if (fallbackDriver.stdout.trim() !== "agent-browser") {
        throw new Error(`unexpected screenshot fallback driver: ${fallbackDriver.stdout.trim()}`)
      }
      const opened = await runDriver(
        ["open", `${baseUrl}/__memory-atlas-browser-harness.html`, "30000"],
        { env: fallbackEnv },
      )
      fallbackHandle = opened.stdout.trim().split(/\s+/)[0]
      await runDriver(["waitjs", fallbackHandle, assertions.waitHarnessReady, "30000"], {
        env: fallbackEnv,
      })
      await runDriver(
        ["shot", fallbackHandle, path.join(evidenceDir, "memory-atlas-1440-390-harness.png")],
        { env: fallbackEnv },
      )
      await writeEvidence(
        "screenshot-fallback.txt",
        "Orca의 비활성 탭 캡처 제한 때문에 browser-driver의 headless 백엔드로 화면 증거를 저장했습니다.\n",
      )
      return
    } catch (error) {
      await writeEvidence(
        "screenshot-fallback.txt",
        `${error instanceof Error ? error.message : String(error)}\n`,
      )
    } finally {
      if (fallbackHandle) {
        await runDriver(["close", fallbackHandle], { allowFailure: true, env: fallbackEnv })
      }
    }
  }

  failures += 1
  console.error(`FAIL screenshot: ${result.stderr.trim() || result.stdout.trim()}`)
}

async function assertNoBrowserErrors() {
  const result = await runDriver(["errors", handle], { allowFailure: true })
  await writeEvidence("errors.txt", `${result.stdout}${result.stderr}`)
  if (result.code !== 0) {
    failures += 1
    console.error(`FAIL browser-errors: ${result.stderr.trim() || result.stdout.trim()}`)
    return
  }

  try {
    const payload = JSON.parse(result.stdout)
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      failures += 1
      console.error(`FAIL browser-errors: ${payload.errors.length} unhandled error(s)`)
    }
  } catch {
    failures += 1
    console.error("FAIL browser-errors: browser-driver returned invalid JSON")
  }
}

function isRecoverableBrowserFailure(result) {
  const output = `${result.stderr}\n${result.stdout}`
  return /runtime closed|runtime_unavailable|timed out|Timeout|timeout/i.test(output)
}

async function openHarnessAndVerifyWorktree(driverName) {
  const opened = await runDriver([
    "open",
    `${baseUrl}/__memory-atlas-browser-harness.html`,
    "30000",
  ])
  handle = opened.stdout.trim().split(/\s+/)[0]
  if (!handle) throw new Error("browser-driver did not return a handle")

  if (driverName === "orca") {
    const actualWorktree = (await runDriver(["worktree", handle])).stdout.trim()
    await writeEvidence("worktree.txt", `${actualWorktree}\n`)
    if (actualWorktree !== worktree) {
      throw new Error(`Orca worktree mismatch: ${actualWorktree} !== ${worktree}`)
    }
  }
}

async function waitHarnessReadyWithSingleRecovery(driverName) {
  const result = await runDriver(["waitjs", handle, assertions.waitHarnessReady, "30000"], {
    allowFailure: true,
  })
  if (result.code === 0) return
  await writeEvidence("wait-harness-ready.failed.stderr", result.stderr)
  if (!recoveredBrowserConnection && isRecoverableBrowserFailure(result)) {
    recoveredBrowserConnection = true
    await runDriver(["close", handle], { allowFailure: true })
    handle = ""
    await openHarnessAndVerifyWorktree(driverName)
    await runDriver(["waitjs", handle, assertions.waitHarnessReady, "30000"])
    await writeEvidence("browser-connection-recovery.txt", "recovered with a fresh handle\n")
    return
  }
  throw new Error(`browser-driver waitjs failed\n${result.stderr || result.stdout}`)
}

async function createHarness() {
  const cacheKey = `memory_atlas_verify=${Date.now()}`
  const harness = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>Memory Atlas Browser Harness</title>
  <style>
    body { margin: 0; background: #05090a; color: #ece3cf; font-family: sans-serif; }
    main { display: grid; gap: 16px; padding: 16px; }
    .viewports { align-items: start; display: flex; gap: 16px; }
    section { border: 1px solid rgba(154, 201, 186, 0.35); padding: 8px; width: max-content; }
    h1, h2 { margin: 0 0 8px; font-size: 14px; }
    .frame-shell { overflow: hidden; }
    .desktop .frame-shell { height: 450px; width: 648px; }
    .mobile .frame-shell { height: 608px; width: 281px; }
    iframe { border: 1px solid rgba(236, 227, 207, 0.24); display: block; background: #020608; transform-origin: top left; }
    .desktop iframe { transform: scale(0.45); }
    .mobile iframe { transform: scale(0.72); }
  </style>
</head>
<body>
  <main>
    <h1>Memory Atlas Browser Harness</h1>
    <div class="viewports">
      <section class="desktop"><h2>desktop 1440×1000</h2><div class="frame-shell"><iframe id="desktop-frame" src="${baseUrl}/?${cacheKey}&viewport=desktop" width="1440" height="1000"></iframe></div></section>
      <section class="mobile"><h2>mobile 390×844</h2><div class="frame-shell"><iframe id="mobile-frame" src="${baseUrl}/?${cacheKey}&viewport=mobile" width="390" height="844"></iframe></div></section>
    </div>
  </main>
</body>
</html>
`
  await fs.writeFile(path.join(quartzDir, "public", "__memory-atlas-browser-harness.html"), harness)
}

async function resetBrowserEvidence() {
  await fs.mkdir(evidenceDir, { recursive: true })
  await Promise.all(
    browserEvidenceNames.map((name) => fs.rm(path.join(evidenceDir, name), { force: true })),
  )
  const existing = await fs.readdir(evidenceDir).catch(() => [])
  await Promise.all(
    existing
      .filter((name) => /^assert-[^.]+\.(stdout|stderr)$/.test(name))
      .map((name) => fs.rm(path.join(evidenceDir, name), { force: true })),
  )
  await fs.writeFile(path.join(evidenceDir, "assertions.jsonl"), "")
}

async function cleanup() {
  if (handle) {
    await runDriver(["console", handle], { allowFailure: true }).then((result) =>
      writeEvidence("console.txt", `${result.stdout}${result.stderr}`),
    )
    await runDriver(["errors", handle], { allowFailure: true }).then((result) =>
      writeEvidence("errors.txt", `${result.stdout}${result.stderr}`),
    )
    await runDriver(["close", handle], { allowFailure: true }).then((result) =>
      writeEvidence("close.txt", `${result.stdout}${result.stderr}`),
    )
  }
  await fs.rm(path.join(quartzDir, "public", "__memory-atlas-browser-harness.html"), {
    force: true,
  })
}

try {
  await resetBrowserEvidence()
  await createHarness()

  const doctor = await runDriver(["doctor"])
  await writeEvidence("doctor.txt", doctor.stdout + doctor.stderr)
  const driverName = (await runDriver(["driver"])).stdout.trim()
  await writeEvidence("driver.txt", `${driverName}\n`)

  await openHarnessAndVerifyWorktree(driverName)
  await waitHarnessReadyWithSingleRecovery(driverName)
  await assertDriver("viewport-basics", assertions.viewportBasics)
  await assertDriver("local-relation-flow", assertions.localRelationFlow)
  await assertDriver("keyboard-accessibility-contract", assertions.keyboardAccessibilityContract)
  await assertDriver("mode-and-lazy-load", assertions.modeAndLazyLoad)
  await assertDriver("reduced-motion", assertions.reducedMotion)
  await assertDriver("semantics-failure-and-privacy", assertions.semanticsFailureAndPrivacy)
  await assertDriver("spa-navigation-and-cleanup", assertions.spaNavigationAndCleanup)
  await assertDriver("brain-ask-regression", assertions.brainAskRegression)
  await assertNoBrowserErrors()
  await captureScreenshot(driverName)
} catch (error) {
  failures += 1
  console.error(error instanceof Error ? error.message : String(error))
} finally {
  await cleanup()
}

const lines = (
  await fs.readFile(path.join(evidenceDir, "assertions.jsonl"), "utf8").catch(() => "")
)
  .split(/\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
await fs.writeFile(path.join(evidenceDir, "assertions.json"), `${JSON.stringify(lines, null, 2)}\n`)

if (failures > 0) process.exit(1)
console.log(`Memory Atlas browser verification passed. Evidence: ${evidenceDir}`)
