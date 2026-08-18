import { classNames } from "../util/lang"
import type {
  KnowledgeAttribution,
  KnowledgeFreshness,
  KnowledgeStatus,
  KnowledgeType,
} from "./knowledgeMetaData"
import { normalizeKnowledgeMetaData } from "./knowledgeMetaData"
import style from "./styles/knowledgeMeta.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const typeLabels: Record<KnowledgeType, string> = {
  concept: "개념",
  topic: "주제",
  entity: "개체",
}

const statusLabels: Record<KnowledgeStatus, string> = {
  draft: "초안",
  stable: "안정",
  deprecated: "사용 중단",
}

function compactDate(timestamp: string): string {
  const date = timestamp.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  return date ?? timestamp
}

function Attribution({ value }: { value: KnowledgeAttribution }) {
  return (
    <span>
      {value.by} <span aria-hidden="true">·</span> {compactDate(value.at)}
    </span>
  )
}

function Freshness({ value }: { value: KnowledgeFreshness }) {
  if (value.state === "invalid") {
    return <span class="knowledge-meta__warning">날짜 확인 필요</span>
  }

  if (value.state === "stale") {
    return (
      <span class="knowledge-meta__warning">
        재검토 필요 <span aria-hidden="true">·</span> {value.date}
      </span>
    )
  }

  return <span>{value.date}</span>
}

const KnowledgeMeta: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const metadata = normalizeKnowledgeMetaData(fileData.frontmatter)
  const hasDetails =
    metadata.type !== undefined ||
    metadata.status !== undefined ||
    metadata.staleAfter !== undefined ||
    metadata.sources.length > 0 ||
    metadata.generated !== undefined ||
    metadata.verified.length > 0

  if (!metadata.description && !hasDetails) return null

  return (
    <section class={classNames(displayClass, "knowledge-meta")} aria-label="지식 메타데이터">
      {metadata.description && <p class="knowledge-meta__description">{metadata.description}</p>}
      {hasDetails && (
        <dl class="knowledge-meta__details">
          {metadata.type && (
            <div>
              <dt>유형</dt>
              <dd>{typeLabels[metadata.type]}</dd>
            </div>
          )}
          {metadata.status && (
            <div>
              <dt>상태</dt>
              <dd class={`knowledge-meta__status knowledge-meta__status--${metadata.status}`}>
                {statusLabels[metadata.status]}
              </dd>
            </div>
          )}
          {metadata.staleAfter && (
            <div>
              <dt>검토 기한</dt>
              <dd>
                <Freshness value={metadata.staleAfter} />
              </dd>
            </div>
          )}
          {metadata.sources.length > 0 && (
            <div>
              <dt>출처</dt>
              <dd>{metadata.sources.length}개</dd>
            </div>
          )}
          {metadata.generated && (
            <div class="knowledge-meta__wide">
              <dt>생성</dt>
              <dd>
                <Attribution value={metadata.generated} />
              </dd>
            </div>
          )}
          {metadata.verified.length > 0 && (
            <div class="knowledge-meta__wide">
              <dt>검증</dt>
              <dd class="knowledge-meta__attributions">
                {metadata.verified.map((entry, index) => (
                  <Attribution key={`${entry.by}-${entry.at}-${index}`} value={entry} />
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  )
}

KnowledgeMeta.css = style

export default (() => KnowledgeMeta) satisfies QuartzComponentConstructor
