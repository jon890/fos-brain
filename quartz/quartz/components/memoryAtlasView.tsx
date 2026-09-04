import { QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { normalizeKnowledgeRole } from "./knowledgeMetaData"

const TYPE_OPTIONS = ["concept", "topic", "entity"] as const
const FRESHNESS_OPTIONS = ["current", "stale", "invalid"] as const
const LAYOUT_OPTIONS = ["constellation", "cluster", "orbit"] as const
const COLOR_OPTIONS = ["type", "freshness", "namespace"] as const
const SPACING_OPTIONS = ["compact", "normal", "wide"] as const

const OPTION_LABELS: Record<string, string> = {
  concept: "개념",
  topic: "주제",
  entity: "개체",
  current: "현재",
  stale: "재검토",
  invalid: "확인 필요",
  public: "공개",
  private: "비공개",
  constellation: "별자리",
  cluster: "묶음",
  orbit: "궤도",
  type: "유형",
  freshness: "최신성",
  namespace: "공개 범위",
  compact: "좁게",
  normal: "보통",
  wide: "넓게",
}

function label(value: string): string {
  return OPTION_LABELS[value] ?? value
}

export const MemoryAtlasAuthView = () => (
  <>
    <div class="memory-atlas__auth" data-testid="memory-atlas-auth">
      <span data-testid="memory-atlas-auth-status" aria-live="polite">
        비로그인
      </span>
      <button type="button" data-testid="memory-atlas-login-open">
        관리자 로그인
      </button>
      <button type="button" data-testid="memory-atlas-logout" hidden>
        로그아웃
      </button>
    </div>
    <dialog
      class="memory-atlas__login"
      data-testid="memory-atlas-login-dialog"
      aria-labelledby="memory-atlas-login-title"
    >
      <form data-testid="memory-atlas-login-form">
        <div class="memory-atlas__login-head">
          <div>
            <p>FOS / ADMIN</p>
            <h2 id="memory-atlas-login-title">관리자 로그인</h2>
          </div>
          <button type="button" data-testid="memory-atlas-login-close" aria-label="로그인 닫기">
            ×
          </button>
        </div>
        <label class="memory-atlas__field" for="memory-atlas-admin-password">
          <span>비밀번호</span>
          <input
            id="memory-atlas-admin-password"
            data-testid="memory-atlas-login-password"
            type="password"
            autocomplete="current-password"
            maxlength={256}
            required
          />
        </label>
        <p data-testid="memory-atlas-login-status" aria-live="polite">
          관리자 비밀번호를 입력하세요.
        </p>
        <div class="memory-atlas__login-actions">
          <button type="submit" data-testid="memory-atlas-login-submit">
            로그인
          </button>
          <button type="button" data-testid="memory-atlas-login-cancel">
            취소
          </button>
        </div>
      </form>
    </dialog>
  </>
)

export const MemoryAtlasView = ({ allFiles, fileData }: QuartzComponentProps) => {
  const fallbackFiles = allFiles
    .filter(
      (file) =>
        file.slug &&
        file.slug.toLowerCase() !== "index" &&
        !file.slug.startsWith("_private/") &&
        normalizeKnowledgeRole(file.frontmatter?.role) !== "navigation",
    )
    .sort((a, b) =>
      (a.frontmatter?.title ?? a.slug ?? "").localeCompare(b.frontmatter?.title ?? b.slug ?? ""),
    )

  return (
    <section
      class="memory-atlas"
      data-testid="memory-atlas"
      data-runtime-2d-src="/static/memory-atlas-2d.js"
      data-runtime-3d-src="/static/memory-atlas-3d.js"
      data-runtime-state="loading"
      data-available-namespaces="public"
      data-auth-state="checking"
      aria-label="기억의 항해도"
    >
      <button
        type="button"
        class="memory-atlas__backdrop"
        data-testid="memory-atlas-backdrop"
        aria-label="필터 닫기"
        hidden
      />

      <aside
        id="memory-atlas-filters"
        class="memory-atlas__rail"
        data-testid="memory-atlas-filters"
        aria-label="탐색 필터"
      >
        <div class="memory-atlas__brand">
          <p>FOS / MEMORY</p>
          <h1>기억의 항해도</h1>
          <span data-testid="memory-atlas-status">지식 관계 지도를 준비하고 있습니다.</span>
        </div>

        <div class="memory-atlas__stats" aria-live="polite">
          <span>
            <strong data-testid="memory-atlas-node-count">{fallbackFiles.length}</strong> nodes
          </span>
          <span>
            <strong data-testid="memory-atlas-link-count">0</strong> links
          </span>
        </div>

        <section class="memory-atlas__entrypoints" aria-label="시작점">
          <h2>시작점</h2>
          <div class="memory-atlas__entrypoint-group" data-testid="memory-atlas-entrypoints-fixed">
            <button type="button" data-memory-atlas-entrypoint="career">
              <span>커리어</span>
              <small>대표 노드를 찾는 중</small>
            </button>
            <button type="button" data-memory-atlas-entrypoint="health">
              <span>건강</span>
              <small>대표 노드를 찾는 중</small>
            </button>
            <button type="button" data-memory-atlas-entrypoint="ai">
              <span>AI</span>
              <small>대표 노드를 찾는 중</small>
            </button>
            <button
              type="button"
              class="memory-atlas__entrypoint-child"
              data-memory-atlas-entrypoint="rag"
            >
              <span>RAG</span>
              <small>현재 집중</small>
            </button>
          </div>
          <details class="memory-atlas__section memory-atlas__entrypoint-auto">
            <summary>발견한 영역</summary>
            <ol data-testid="memory-atlas-entrypoints-auto"></ol>
          </details>
        </section>

        <label class="memory-atlas__field">
          <span>검색</span>
          <div class="memory-atlas__search-control">
            <input
              data-testid="memory-atlas-search"
              type="search"
              placeholder="제목 또는 태그"
              autocomplete="off"
            />
            <button
              type="button"
              data-memory-atlas-search-clear
              data-search-target="memory-atlas-search"
              aria-label="검색어 지우기"
              hidden
            >
              ×
            </button>
          </div>
        </label>

        <details class="memory-atlas__section" open>
          <summary>렌즈</summary>
          <fieldset class="memory-atlas__chips" data-testid="memory-atlas-type-filter">
            <legend>유형</legend>
            {TYPE_OPTIONS.map((type) => (
              <label>
                <input type="checkbox" name="memory-atlas-type" value={type} checked />
                <span>{label(type)}</span>
              </label>
            ))}
          </fieldset>

          <fieldset class="memory-atlas__chips" data-testid="memory-atlas-namespace-filter">
            <legend>공개 범위</legend>
            <label>
              <input type="checkbox" name="memory-atlas-namespace" value="public" checked />
              <span>{label("public")}</span>
            </label>
          </fieldset>
        </details>

        <details class="memory-atlas__section">
          <summary>상태와 태그</summary>
          <fieldset class="memory-atlas__chips" data-testid="memory-atlas-freshness-filter">
            <legend>최신성</legend>
            {FRESHNESS_OPTIONS.map((freshness) => (
              <label>
                <input type="checkbox" name="memory-atlas-freshness" value={freshness} checked />
                <span>{label(freshness)}</span>
              </label>
            ))}
          </fieldset>

          <label class="memory-atlas__field">
            <span>태그</span>
            <select data-testid="memory-atlas-tag-filter" multiple size={5}></select>
          </label>
        </details>

        <details class="memory-atlas__section">
          <summary>표시</summary>
          <div class="memory-atlas__controls">
            <label class="memory-atlas__field">
              <span>보기 모드</span>
              <select data-testid="memory-atlas-mode" aria-label="지도 보기 모드">
                <option value="2d">2D 관계 지도</option>
                <option value="3d">3D 별자리</option>
              </select>
            </label>
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
        </details>

        <div class="memory-atlas__actions">
          <button type="button" data-testid="memory-atlas-recenter" class="memory-atlas__button">
            중앙 정렬
          </button>
        </div>

        <section class="memory-atlas__results" aria-label="검색 결과">
          <h2>검색 결과</h2>
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
      </aside>

      <div class="memory-atlas__stage">
        <div class="memory-atlas__topbar">
          <button
            type="button"
            class="memory-atlas__mobile-toggle"
            data-testid="memory-atlas-filter-toggle"
            aria-expanded="false"
            aria-controls="memory-atlas-filters"
            aria-label="탐색 필터 열기"
          >
            필터
          </button>
          <button
            type="button"
            class="memory-atlas__ask-toggle"
            data-testid="memory-atlas-ask-toggle"
            aria-expanded="false"
            aria-controls="memory-atlas-ask-panel"
            hidden
          >
            Brain에게 묻기
          </button>
          <div class="memory-atlas__mode-switch" aria-label="지도 보기 전환">
            <button type="button" data-memory-atlas-mode-button="2d" aria-pressed="true">
              2D 관계
            </button>
            <button type="button" data-memory-atlas-mode-button="3d" aria-pressed="false">
              3D 조망
            </button>
          </div>
          <label class="memory-atlas__field">
            <span>검색</span>
            <div class="memory-atlas__search-control">
              <input
                data-testid="memory-atlas-mobile-search"
                type="search"
                placeholder="기억 검색"
                autocomplete="off"
              />
              <button
                type="button"
                data-memory-atlas-search-clear
                data-search-target="memory-atlas-mobile-search"
                aria-label="검색어 지우기"
                hidden
              >
                ×
              </button>
            </div>
          </label>
          <MemoryAtlasAuthView />
        </div>

        <div class="memory-atlas__context" data-testid="memory-atlas-context" aria-live="polite">
          <button type="button" data-testid="memory-atlas-clear-selection" hidden>
            전체 지도로
          </button>
          <div>
            <span>현재 중심</span>
            <strong data-testid="memory-atlas-context-title">전체 지도</strong>
          </div>
          <p data-testid="memory-atlas-depth-legend">
            선택 1.0 · 1-hop 0.9 · 2-hop 0.56 · 3-hop 0.32 · 배경 0.13
          </p>
          <p data-testid="memory-atlas-relation-legend">wiki 링크 · 의미 유사도</p>
        </div>

        <div
          class="memory-atlas__canvas"
          data-testid="memory-atlas-canvas"
          role="application"
          aria-label="지식 관계 지도"
        >
          <div class="memory-atlas__loading" data-testid="memory-atlas-loading">
            지식 관계 지도를 불러오는 중입니다.
          </div>
        </div>

        <div class="memory-atlas__empty" data-testid="memory-atlas-empty" hidden>
          <p>조건에 맞는 문서가 없습니다.</p>
          <button type="button" data-testid="memory-atlas-reset">
            조건 초기화
          </button>
        </div>

        <div class="memory-atlas__error" data-testid="memory-atlas-error" hidden>
          <p data-testid="memory-atlas-error-message">지식 관계 지도를 초기화하지 못했습니다.</p>
          <button type="button" data-testid="memory-atlas-retry">
            다시 시도
          </button>
        </div>

        <aside
          id="memory-atlas-ask-panel"
          class="memory-atlas__ask"
          data-testid="memory-atlas-ask-panel"
          aria-label="Brain에게 묻기"
          hidden
        >
          <div class="memory-atlas__ask-head">
            <p>public·private wiki 근거만 사용하며 질문과 답변은 저장하지 않습니다.</p>
            <button type="button" data-testid="memory-atlas-ask-close" aria-label="질문 패널 닫기">
              ×
            </button>
          </div>
          <form data-testid="memory-atlas-ask-form">
            <label class="memory-atlas__field" for="memory-atlas-question">
              <span>질문</span>
              <textarea
                id="memory-atlas-question"
                data-testid="memory-atlas-ask-question"
                maxlength={500}
                rows={4}
                placeholder="이 brain에서 근거를 찾아 답할 질문"
              ></textarea>
            </label>
            <div class="memory-atlas__ask-meta">
              <span data-testid="memory-atlas-ask-count">0 / 500</span>
              <span data-testid="memory-atlas-ask-status" aria-live="polite">
                질문을 입력하세요.
              </span>
            </div>
            <div class="memory-atlas__ask-actions">
              <button type="submit" data-testid="memory-atlas-ask-submit">
                질문하기
              </button>
              <button type="button" data-testid="memory-atlas-ask-retry" hidden>
                다시 시도
              </button>
            </div>
          </form>
          <section class="memory-atlas__ask-answer" data-testid="memory-atlas-ask-answer" hidden>
            <h2>답변</h2>
            <p data-testid="memory-atlas-ask-answer-text"></p>
          </section>
          <section class="memory-atlas__ask-sources" data-testid="memory-atlas-ask-sources" hidden>
            <h2>근거</h2>
            <ol data-testid="memory-atlas-ask-source-list"></ol>
          </section>
        </aside>
      </div>

      <aside
        class="memory-atlas__detail"
        data-testid="memory-atlas-detail"
        aria-label="선택 상세"
        aria-live="polite"
      >
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
