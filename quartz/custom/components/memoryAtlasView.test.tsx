import assert from "node:assert"
import test, { describe } from "node:test"
import render from "preact-render-to-string"
import type { FullSlug } from "../../quartz/util/path"
import type { QuartzComponentProps } from "../../quartz/components/types"
import { MemoryAtlasView } from "./memoryAtlasView"

function file(slug: string, title: string, role?: string) {
  return {
    slug: slug as FullSlug,
    frontmatter: role ? { title, role } : { title },
  }
}

/**
 * `marker` 가 든 여는 태그부터 그 태그가 닫히는 자리까지를 잘라 낸다.
 * 속성 출력 순서를 정규식으로 전제하면 렌더러 구현에 검사가 묶인다.
 */
function sliceTag(html: string, marker: string): string {
  const markerAt = html.indexOf(marker)
  assert.ok(markerAt >= 0, `${marker} 를 찾지 못했다`)
  const openAt = html.lastIndexOf("<", markerAt)
  const tagName = html.slice(openAt + 1).match(/^[a-zA-Z0-9-]+/)?.[0]
  assert.ok(tagName, `${marker} 앞에서 태그 이름을 찾지 못했다`)
  // 같은 이름의 태그가 안에 또 있으므로 깊이를 세어 짝이 맞는 닫는 태그를 찾는다.
  const boundary = new RegExp(`</?${tagName}(?=[\\s/>])`, "g")
  boundary.lastIndex = openAt
  let depth = 0
  for (let match = boundary.exec(html); match; match = boundary.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : 1
    if (depth === 0) return html.slice(openAt, html.indexOf(">", match.index) + 1)
  }
  assert.fail(`${marker} 의 닫는 태그를 찾지 못했다`)
}

/** 여는 태그의 속성 부분만 돌려준다. 자식 텍스트가 검사에 섞이지 않게 한다. */
function attributesOf(tag: string): string {
  return tag.slice(0, tag.indexOf(">") + 1)
}

describe("MemoryAtlasView", () => {
  test("renders a public-only accessible SSR fallback and split runtime boundaries", () => {
    const props = {
      allFiles: [
        file("concepts/rag", "RAG"),
        file("_private/concepts/work", "Work"),
        file("log", "활동 기록", "navigation"),
      ],
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
    assert.doesNotMatch(html, /활동 기록/)
    assert.doesNotMatch(html, /_private/)
    assert.doesNotMatch(html, /value="private"/)
    assert.match(html, /data-testid="memory-atlas-ask-toggle"[^>]*hidden/)
  })

  test("offers viewport controls that reach a narrow screen", () => {
    const props = {
      allFiles: [file("concepts/rag", "RAG")],
      fileData: { slug: "index" as FullSlug },
    } as unknown as QuartzComponentProps
    const html = render(<MemoryAtlasView {...props} />)

    // 800px 이하에서 rail 은 화면 밖으로 밀리므로 배율 조작은 topbar 안에 있어야 한다.
    const topbar = sliceTag(html, 'class="memory-atlas__topbar"')
    const group = sliceTag(topbar, 'data-testid="memory-atlas-viewport-controls"')
    for (const testid of [
      "memory-atlas-zoom-out",
      "memory-atlas-zoom-in",
      "memory-atlas-reset-viewport",
    ]) {
      assert.ok(group.includes(`data-testid="${testid}"`), `${testid} 가 배율 조작 그룹에 없다`)
    }
    for (const label of ["축소", "확대", "전체 보기"]) {
      assert.ok(group.includes(label), `${label} 라벨이 배율 조작 그룹에 없다`)
    }

    // 접근 가능한 이름이 시각 라벨과 어긋나면 음성 조작이 버튼에 닿지 않는다(WCAG 2.5.3).
    const resetButton = sliceTag(group, 'data-testid="memory-atlas-reset-viewport"')
    assert.ok(!/aria-label=/.test(attributesOf(resetButton)), "전체 보기에 aria-label 이 남아 있다")
    assert.match(attributesOf(resetButton), /type="button"/)
    assert.match(attributesOf(resetButton), /title="[^"]+"/)

    // 선택 해제와 시야 초기화는 서로 다른 동작이라 버튼을 나눈다.
    assert.match(html, /전체 지도로/)
  })
})
