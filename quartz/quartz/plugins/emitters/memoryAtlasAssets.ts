import esbuild from "esbuild"
import fs from "fs/promises"
import path from "path"
import { FullSlug, joinSegments } from "../../util/path"
import {
  createEmptyPublishedMemoryAtlasSemantics,
  parseMemoryAtlasSemantics,
  restrictMemoryAtlasSemanticsToSlugs,
} from "../../components/memoryAtlasSemantics"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

export const MemoryAtlasAssets: QuartzEmitterPlugin = () => ({
  name: "MemoryAtlasAssets",
  async *emit(ctx, content) {
    const entryPoint = path.join(
      process.cwd(),
      "quartz",
      "components",
      "scripts",
      "memoryAtlasRuntime.ts",
    )
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: ["es2022"],
      minify: true,
      write: false,
    })

    const bundled = result.outputFiles[0]?.contents
    if (!bundled) throw new Error("Memory Atlas runtime bundle was not generated")

    yield write({
      ctx,
      slug: joinSegments("static", "memory-atlas") as FullSlug,
      ext: ".js",
      content: Buffer.from(bundled),
    })

    const semantics = await readPublishedSemantics(
      path.join(process.cwd(), ".generated", "memory-atlas-semantics.json"),
      content.map(([, file]) => file.data.slug!).filter(Boolean),
    )

    yield write({
      ctx,
      slug: joinSegments("static", "memory-atlas-semantics") as FullSlug,
      ext: ".json",
      content: JSON.stringify(semantics),
    })
  },
})

async function readPublishedSemantics(generatedPath: string, currentSlugs: FullSlug[]) {
  try {
    const raw = await fs.readFile(generatedPath, "utf8")
    const parsedJson = JSON.parse(raw)
    const parsed = parseMemoryAtlasSemantics(parsedJson)
    if (!parsed.ok) return createEmptyPublishedMemoryAtlasSemantics()

    const allowPrivate = currentSlugs.some((slug) => slug.startsWith("_private/"))
    return restrictMemoryAtlasSemanticsToSlugs(parsed.artifact, currentSlugs, { allowPrivate })
  } catch {
    return createEmptyPublishedMemoryAtlasSemantics()
  }
}
