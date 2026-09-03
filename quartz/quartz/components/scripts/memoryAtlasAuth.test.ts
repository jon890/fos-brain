import assert from "node:assert"
import test, { afterEach, describe } from "node:test"
import {
  getMemoryAtlasAuthSession,
  isMemoryAtlasUnauthorized,
  loadProtectedMemoryAtlasData,
  loginMemoryAtlasAdmin,
  logoutMemoryAtlasAdmin,
  MemoryAtlasAuthError,
} from "./memoryAtlasAuth"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("memory atlas auth client", () => {
  test("normalizes public sessions and uses no-store same-origin requests", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    globalThis.fetch = async (input, init) => {
      requests.push({ input, init })
      return Response.json({ role: "public", expiresAt: null })
    }

    assert.deepStrictEqual(await getMemoryAtlasAuthSession(), { role: "public", expiresAt: null })
    assert.strictEqual(requests[0].input, "/api/auth/session")
    assert.strictEqual(requests[0].init?.cache, "no-store")
    assert.strictEqual(requests[0].init?.credentials, "same-origin")
  })

  test("sends the password only in the login request body", async () => {
    let requestBody = ""
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body)
      return Response.json({ role: "admin", expiresAt: "2026-09-04T00:00:00.000Z" })
    }

    const session = await loginMemoryAtlasAdmin("temporary-password")

    assert.strictEqual(session.role, "admin")
    assert.deepStrictEqual(JSON.parse(requestBody), { password: "temporary-password" })
  })

  test("loads both protected artifacts before returning", async () => {
    const requested: string[] = []
    globalThis.fetch = async (input) => {
      requested.push(String(input))
      if (String(input).endsWith("content-index")) {
        return Response.json({ "concepts/rag": { title: "RAG", links: [], tags: [] } })
      }
      return Response.json({ schemaVersion: 1, edges: [] })
    }

    const result = await loadProtectedMemoryAtlasData()

    assert.deepStrictEqual(requested.sort(), [
      "/api/private/content-index",
      "/api/private/memory-atlas-semantics",
    ])
    assert.strictEqual(result.contentIndex["concepts/rag"].title, "RAG")
  })

  test("preserves unauthorized status and rate-limit retry time", async () => {
    globalThis.fetch = async () =>
      Response.json(
        { error: { code: "login_rate_limited" } },
        { status: 429, headers: { "retry-after": "60" } },
      )

    await assert.rejects(loginMemoryAtlasAdmin("wrong"), (error: unknown) => {
      assert(error instanceof MemoryAtlasAuthError)
      assert.strictEqual(error.status, 429)
      assert.strictEqual(error.code, "login_rate_limited")
      assert(error.retryAt instanceof Date)
      return true
    })

    assert.strictEqual(isMemoryAtlasUnauthorized(new MemoryAtlasAuthError(401, "expired")), true)
    assert.strictEqual(isMemoryAtlasUnauthorized(new Error("401")), false)
  })

  test("accepts the empty successful logout response", async () => {
    globalThis.fetch = async () => new Response(null, { status: 204 })
    await logoutMemoryAtlasAdmin()
  })
})
