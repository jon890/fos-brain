import {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "../../quartz/components/types"
import { FullSlug, resolveRelative } from "../../quartz/util/path"
import style from "./styles/memoryAtlas.scss"

const MemoryAtlasDocNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const slug = fileData.slug
  if (!slug || slug.toLowerCase() === "index") return null

  const returnUrl = `${resolveRelative(slug, "index" as FullSlug)}?node=${encodeURIComponent(slug)}`

  return (
    <nav class="memory-atlas-doc-nav" aria-label="Memory Atlas 문서 탐색">
      <a class="memory-atlas-doc-return" href={returnUrl}>
        <span aria-hidden="true">←</span>
        항해도로 돌아가기
      </a>
      <span class="memory-atlas-doc-brand">FOS / MEMORY</span>
    </nav>
  )
}

MemoryAtlasDocNav.css = style

export default (() => MemoryAtlasDocNav) satisfies QuartzComponentConstructor
