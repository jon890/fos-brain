import { QuartzComponent, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/memoryAtlas.inline"
import style from "./styles/memoryAtlas.scss"
import { FullSlug, resolveRelative } from "../util/path"

const TYPE_OPTIONS = ["concept", "topic", "entity"] as const
const FRESHNESS_OPTIONS = ["current", "stale", "invalid"] as const
const NAMESPACE_OPTIONS = ["public", "private"] as const
const LAYOUT_OPTIONS = ["constellation", "cluster", "orbit"] as const
const COLOR_OPTIONS = ["type", "freshness", "namespace"] as const
const SPACING_OPTIONS = ["compact", "normal", "wide"] as const

function label(value: string): string {
  return value.replace(/^\w/, (char) => char.toUpperCase())
}

function availableNamespaces(files: QuartzComponentProps["allFiles"]) {
  const namespaces = new Set(["public"])
  if (files.some((file) => file.slug?.startsWith("_private/"))) {
    namespaces.add("private")
  }
  return NAMESPACE_OPTIONS.filter((namespace) => namespaces.has(namespace))
}

const MemoryAtlas: QuartzComponent = ({ allFiles, fileData }: QuartzComponentProps) => {
  const namespaces = availableNamespaces(allFiles)
  const fallbackFiles = allFiles
    .filter((file) => file.slug && file.slug.toLowerCase() !== "index")
    .sort((a, b) =>
      (a.frontmatter?.title ?? a.slug ?? "").localeCompare(b.frontmatter?.title ?? b.slug ?? ""),
    )

  return (
    <section
      class="memory-atlas"
      data-testid="memory-atlas"
      data-runtime-src="/static/memory-atlas.js"
      data-runtime-state="loading"
      data-available-namespaces={namespaces.join(",")}
      aria-label="기억의 항해도"
    >
      <aside class="memory-atlas__rail" data-testid="memory-atlas-filters" aria-label="탐색 필터">
        <div class="memory-atlas__brand">
          <p>FOS / MEMORY</p>
          <h1>기억의 항해도</h1>
        </div>

        <div class="memory-atlas__stats" aria-live="polite">
          <strong data-testid="memory-atlas-node-count">{fallbackFiles.length}</strong>
          <span>nodes</span>
          <strong data-testid="memory-atlas-link-count">0</strong>
          <span>links</span>
        </div>

        <label class="memory-atlas__field">
          <span>검색</span>
          <input
            data-testid="memory-atlas-search"
            type="search"
            placeholder="제목 또는 태그"
            autocomplete="off"
          />
        </label>

        <fieldset class="memory-atlas__fieldset" data-testid="memory-atlas-type-filter">
          <legend>유형</legend>
          {TYPE_OPTIONS.map((type) => (
            <label>
              <input type="checkbox" name="memory-atlas-type" value={type} checked />
              <span>{type}</span>
            </label>
          ))}
        </fieldset>

        <fieldset class="memory-atlas__fieldset" data-testid="memory-atlas-freshness-filter">
          <legend>최신성</legend>
          {FRESHNESS_OPTIONS.map((freshness) => (
            <label>
              <input type="checkbox" name="memory-atlas-freshness" value={freshness} checked />
              <span>{freshness}</span>
            </label>
          ))}
        </fieldset>

        <fieldset class="memory-atlas__fieldset" data-testid="memory-atlas-namespace-filter">
          <legend>공개 범위</legend>
          {namespaces.map((namespace) => (
            <label>
              <input type="checkbox" name="memory-atlas-namespace" value={namespace} checked />
              <span>{namespace}</span>
            </label>
          ))}
        </fieldset>

        <label class="memory-atlas__field">
          <span>태그</span>
          <select data-testid="memory-atlas-tag-filter" multiple size={5}></select>
        </label>

        <div class="memory-atlas__controls">
          <label class="memory-atlas__field">
            <span>배치</span>
            <select data-testid="memory-atlas-layout">
              {LAYOUT_OPTIONS.map((layout) => (
                <option value={layout}>{label(layout)}</option>
              ))}
            </select>
          </label>
          <label class="memory-atlas__field">
            <span>색상</span>
            <select data-testid="memory-atlas-color">
              {COLOR_OPTIONS.map((color) => (
                <option value={color}>{label(color)}</option>
              ))}
            </select>
          </label>
          <label class="memory-atlas__field">
            <span>간격</span>
            <select data-testid="memory-atlas-spacing">
              {SPACING_OPTIONS.map((spacing) => (
                <option value={spacing}>{label(spacing)}</option>
              ))}
            </select>
          </label>
        </div>

        <label class="memory-atlas__toggle">
          <input data-testid="memory-atlas-labels" type="checkbox" checked />
          <span>라벨 표시</span>
        </label>

        <button type="button" data-testid="memory-atlas-recenter" class="memory-atlas__button">
          화면 중앙 정렬
        </button>
      </aside>

      <div class="memory-atlas__stage">
        <div class="memory-atlas__topbar">
          <button
            type="button"
            class="memory-atlas__mobile-toggle"
            data-testid="memory-atlas-filter-toggle"
            aria-expanded="false"
          >
            필터
          </button>
          <div class="memory-atlas__status" data-testid="memory-atlas-status">
            3D 탐색 엔진을 준비하고 있습니다.
          </div>
        </div>

        <div
          class="memory-atlas__canvas"
          data-testid="memory-atlas-canvas"
          role="application"
          aria-label="3D 지식 별자리"
        >
          <div class="memory-atlas__loading" data-testid="memory-atlas-loading">
            지식 별자리를 불러오는 중입니다.
          </div>
        </div>

        <div class="memory-atlas__empty" data-testid="memory-atlas-empty" hidden>
          <p>조건에 맞는 문서가 없습니다.</p>
          <button type="button" data-testid="memory-atlas-reset">
            조건 초기화
          </button>
        </div>

        <div class="memory-atlas__error" data-testid="memory-atlas-error" hidden>
          <p data-testid="memory-atlas-error-message">3D 그래프를 초기화하지 못했습니다.</p>
          <button type="button" data-testid="memory-atlas-retry">
            다시 시도
          </button>
        </div>

        <section class="memory-atlas__results" aria-label="검색 결과">
          <h2>문서 목록</h2>
          <ol data-testid="memory-atlas-results">
            {fallbackFiles.map((file) => {
              const slug = file.slug as FullSlug
              const title = file.frontmatter?.title ?? slug
              return (
                <li data-slug={slug}>
                  <a class="internal" href={resolveRelative(fileData.slug!, slug)}>
                    {title}
                  </a>
                  <span>{slug}</span>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <aside class="memory-atlas__detail" data-testid="memory-atlas-detail" aria-live="polite">
        <button type="button" data-testid="memory-atlas-detail-close" aria-label="상세 닫기">
          ×
        </button>
        <p class="memory-atlas__detail-kicker" data-testid="memory-atlas-detail-type">
          선택한 기억
        </p>
        <h2 data-testid="memory-atlas-detail-title">노드를 선택하세요</h2>
        <p data-testid="memory-atlas-detail-description">
          그래프나 목록에서 문서를 선택하면 상세 정보가 여기에 표시됩니다.
        </p>
        <dl>
          <div>
            <dt>상태</dt>
            <dd data-testid="memory-atlas-detail-status">-</dd>
          </div>
          <div>
            <dt>수정일</dt>
            <dd data-testid="memory-atlas-detail-updated">-</dd>
          </div>
          <div>
            <dt>태그</dt>
            <dd data-testid="memory-atlas-detail-tags">-</dd>
          </div>
          <div>
            <dt>연결</dt>
            <dd data-testid="memory-atlas-detail-degree">0 in / 0 out</dd>
          </div>
        </dl>
        <a class="memory-atlas__source" data-testid="memory-atlas-detail-link" href="#">
          원문 열기
        </a>
      </aside>
    </section>
  )
}

MemoryAtlas.css = style
MemoryAtlas.afterDOMLoaded = script

export default (() => MemoryAtlas) satisfies () => QuartzComponent
