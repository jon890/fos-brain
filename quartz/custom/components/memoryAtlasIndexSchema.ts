/**
 * Memory Atlas 색인 계약의 표식과 검사기를 소유한다.
 *
 * 공개 색인(`/static/memory-atlas-index.json`)과 관리자 색인
 * (`/api/private/content-index`)은 같은 표식을 담는다.
 * 표식이 없으면 업스트림 `contentIndex.json` 이 들어온 것이므로,
 * 필드가 비어 화면이 조용히 나빠지는 대신 그 자리에서 실패한다.
 */
export const MEMORY_ATLAS_INDEX_SCHEMA_KEY = "$memoryAtlasIndexSchema"
export const MEMORY_ATLAS_INDEX_SCHEMA = "fos-brain/memory-atlas-index@1"

export function memoryAtlasIndexSchemaMarker(): Record<string, string> {
  return { [MEMORY_ATLAS_INDEX_SCHEMA_KEY]: MEMORY_ATLAS_INDEX_SCHEMA }
}

/**
 * 표식을 검사하고 제거한 색인 항목만 돌려준다.
 * `source` 는 실패 메시지에 들어가는 색인 출처 이름이다.
 */
export function parseMemoryAtlasIndex<T>(value: unknown, source: string): Record<string, T> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${source} is not a Memory Atlas index object`)
  }

  const record = value as Record<string, unknown>
  if (record[MEMORY_ATLAS_INDEX_SCHEMA_KEY] !== MEMORY_ATLAS_INDEX_SCHEMA) {
    throw new Error(
      `${source} is missing the "${MEMORY_ATLAS_INDEX_SCHEMA}" schema marker; it is likely the upstream contentIndex.json`,
    )
  }

  const entries: Record<string, T> = {}
  for (const [slug, entry] of Object.entries(record)) {
    if (slug === MEMORY_ATLAS_INDEX_SCHEMA_KEY) continue
    entries[slug] = entry as T
  }
  return entries
}
