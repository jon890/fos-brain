import { QuartzEmitterPlugin } from "../../quartz/plugins/types"
import { write } from "../../quartz/plugins/emitters/helpers"
import { FullSlug, SimpleSlug, joinSegments } from "../../quartz/util/path"
import { getDate } from "../../quartz/components/Date"
import { normalizeKnowledgeMetaData } from "../components/knowledgeMetaData"
import { memoryAtlasIndexSchemaMarker } from "../components/memoryAtlasIndexSchema"
import type {
  KnowledgeFreshness,
  KnowledgeRole,
  KnowledgeStatus,
  KnowledgeType,
} from "../components/knowledgeMetaData"

/** Memory Atlas 가 읽는 색인의 항목 하나. 업스트림 `ContentDetails` 와 별개다. */
export type MemoryAtlasIndexEntry = {
  slug: FullSlug
  title: string
  links: SimpleSlug[]
  tags: string[]
  description?: string
  type?: KnowledgeType
  role?: KnowledgeRole
  status?: KnowledgeStatus
  freshness?: KnowledgeFreshness
  updated?: string
  sourceCount: number
}

export type MemoryAtlasIndex = Record<FullSlug, MemoryAtlasIndexEntry>

export const MemoryAtlasIndexEmitter: QuartzEmitterPlugin = () => ({
  name: "MemoryAtlasIndex",
  async *emit(ctx, content) {
    const index: MemoryAtlasIndex = {}
    for (const [, file] of content) {
      const slug = file.data.slug!
      const metadata = normalizeKnowledgeMetaData(file.data.frontmatter)
      const updatedDate = getDate(ctx.cfg.configuration, file.data)

      index[slug] = {
        slug,
        title: file.data.frontmatter?.title!,
        links: file.data.links ?? [],
        tags: file.data.frontmatter?.tags ?? [],
        description: metadata.description,
        type: metadata.type,
        role: metadata.role,
        status: metadata.status,
        freshness: metadata.staleAfter,
        updated: updatedDate?.toISOString(),
        sourceCount: metadata.sources.length,
      }
    }

    yield write({
      ctx,
      slug: joinSegments("static", "memory-atlas-index") as FullSlug,
      ext: ".json",
      content: JSON.stringify({ ...memoryAtlasIndexSchemaMarker(), ...index }),
    })
  },
})
