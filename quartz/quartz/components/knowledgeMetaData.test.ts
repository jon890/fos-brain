import assert from "node:assert"
import test, { describe } from "node:test"
import {
  normalizeKnowledgeMetaData,
  normalizeKnowledgeRole,
  normalizeKnowledgeType,
} from "./knowledgeMetaData"

describe("knowledge metadata normalization", () => {
  test("normalizes supported metadata without losing valid provenance entries", () => {
    const normalized = normalizeKnowledgeMetaData(
      {
        description: "  에이전트 검색의 범위와 근거를 설명한다.  ",
        type: " Topic ",
        status: "STABLE",
        stale_after: "2026-08-17",
        sources: [
          { resource: "raw/notes/source.md", title: "원본 메모" },
          { id: "raw-note", resource: "raw/notes/identified-source.md" },
          { id: "missing-resource" },
        ],
        generated: { by: "brain-add", at: "2026-08-01T03:00:00.000Z" },
        verified: [
          { by: "human", at: "2026-08-15" },
          { by: "", at: "2026-08-16" },
        ],
      },
      new Date("2026-08-18T12:00:00Z"),
    )

    assert.deepStrictEqual(normalized, {
      description: "에이전트 검색의 범위와 근거를 설명한다.",
      type: "topic",
      role: undefined,
      status: "stable",
      staleAfter: { date: "2026-08-17", state: "stale" },
      sources: [
        { resource: "raw/notes/source.md", title: "원본 메모" },
        { id: "raw-note", resource: "raw/notes/identified-source.md" },
      ],
      generated: { by: "brain-add", at: "2026-08-01T03:00:00.000Z" },
      verified: [{ by: "human", at: "2026-08-15" }],
    })
  })

  test("reads the navigation role regardless of case and drops unknown roles", () => {
    assert.strictEqual(normalizeKnowledgeRole(" NAVIGATION "), "navigation")
    assert.strictEqual(normalizeKnowledgeRole("navigation"), "navigation")
    assert.strictEqual(normalizeKnowledgeRole("hub"), undefined)
    assert.strictEqual(normalizeKnowledgeRole(42), undefined)
    assert.strictEqual(normalizeKnowledgeMetaData({ role: "Navigation" }).role, "navigation")
    assert.strictEqual(normalizeKnowledgeMetaData({ role: "hub" }).role, undefined)
  })

  test("normalizes bare verified mapping as a single attribution", () => {
    const normalized = normalizeKnowledgeMetaData({
      verified: { by: "reviewer", at: "2026-08-18" },
    })

    assert.deepStrictEqual(normalized.verified, [{ by: "reviewer", at: "2026-08-18" }])
  })

  test("keeps sparse and malformed metadata renderable", () => {
    const normalized = normalizeKnowledgeMetaData({
      description: 42,
      type: "guide",
      status: "finished",
      sources: "raw/source.md",
      generated: { by: "agent", at: "not-a-date" },
      verified: [{ by: "reviewer" }, null],
    })

    assert.deepStrictEqual(normalized, {
      description: undefined,
      type: undefined,
      role: undefined,
      status: undefined,
      staleAfter: undefined,
      sources: [],
      generated: undefined,
      verified: [],
    })
  })

  test("reports an invalid stale date without exposing the invalid value", () => {
    const normalized = normalizeKnowledgeMetaData({ stale_after: "2026-02-30" })
    assert.deepStrictEqual(normalized.staleAfter, { state: "invalid" })
  })

  test("treats today and past review dates as stale", () => {
    const today = new Date("2026-08-18T12:00:00")
    assert.deepStrictEqual(
      normalizeKnowledgeMetaData({ stale_after: "2026-08-17" }, today).staleAfter,
      { date: "2026-08-17", state: "stale" },
    )
    assert.deepStrictEqual(
      normalizeKnowledgeMetaData({ stale_after: "2026-08-18" }, today).staleAfter,
      { date: "2026-08-18", state: "stale" },
    )
  })

  test("treats future review dates as current", () => {
    const today = new Date("2026-08-18T12:00:00")
    assert.deepStrictEqual(
      normalizeKnowledgeMetaData({ stale_after: "2026-08-19" }, today).staleAfter,
      { date: "2026-08-19", state: "current" },
    )
  })

  test("normalizes only supported graph types", () => {
    assert.strictEqual(normalizeKnowledgeType(" Concept "), "concept")
    assert.strictEqual(normalizeKnowledgeType("reference"), undefined)
    assert.strictEqual(normalizeKnowledgeType(null), undefined)
  })
})
