import assert from "node:assert"
import test, { describe } from "node:test"
import render from "preact-render-to-string"
import type { FullSlug } from "../util/path"
import type { QuartzComponentProps } from "./types"
import { MemoryAtlasView } from "./memoryAtlasView"

function file(slug: string, title: string) {
  return {
    slug: slug as FullSlug,
    frontmatter: { title },
  }
}

describe("MemoryAtlasView", () => {
  test("renders a public-only accessible SSR fallback and split runtime boundaries", () => {
    const props = {
      allFiles: [file("concepts/rag", "RAG"), file("_private/concepts/work", "Work")],
      fileData: { slug: "index" as FullSlug },
    } as unknown as QuartzComponentProps
    const html = render(<MemoryAtlasView {...props} />)

    assert.match(html, /data-runtime-2d-src="\/static\/memory-atlas-2d\.js"/)
    assert.match(html, /data-runtime-3d-src="\/static\/memory-atlas-3d\.js"/)
    assert.match(html, /data-testid="memory-atlas-mode"/)
    assert.match(html, /2D 관계 지도/)
    assert.match(html, /data-auth-state="checking"/)
    assert.match(html, /관리자 로그인/)
    assert.match(html, /type="password"/)
    assert.match(html, /RAG/)
    assert.doesNotMatch(html, /Work/)
    assert.doesNotMatch(html, /_private/)
    assert.doesNotMatch(html, /value="private"/)
    assert.match(html, /data-testid="memory-atlas-ask-toggle"[^>]*hidden/)
  })

  test("offers a viewport reset button next to the recenter action", () => {
    const props = {
      allFiles: [file("concepts/rag", "RAG")],
      fileData: { slug: "index" as FullSlug },
    } as unknown as QuartzComponentProps
    const html = render(<MemoryAtlasView {...props} />)

    assert.match(html, /data-testid="memory-atlas-reset-viewport"/)
    assert.match(html, /전체 보기/)
    assert.match(html, /data-testid="memory-atlas-reset-viewport"[^>]*type="button"/)
    assert.match(html, /data-testid="memory-atlas-reset-viewport"[^>]*aria-label="[^"]+"/)
    // 선택 해제와 시야 초기화는 서로 다른 동작이라 버튼을 나눈다.
    assert.match(html, /전체 지도로/)
  })
})
