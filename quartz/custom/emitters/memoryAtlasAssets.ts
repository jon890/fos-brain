import esbuild from "esbuild"
import fs from "fs/promises"
import path from "path"
import { FullSlug, joinSegments } from "../../quartz/util/path"
import {
  createEmptyPublishedMemoryAtlasSemantics,
  parseMemoryAtlasSemantics,
  restrictMemoryAtlasSemanticsToSlugs,
} from "../components/memoryAtlasSemantics"
import { QuartzEmitterPlugin } from "../../quartz/plugins/types"
import { write } from "../../quartz/plugins/emitters/helpers"

export const MemoryAtlasAssets: QuartzEmitterPlugin = () => ({
  name: "MemoryAtlasAssets",
  async *emit(ctx, content) {
    const result = await esbuild.build({
      entryPoints: {
        "memory-atlas-2d": path.join(
          process.cwd(),
          "custom",
          "components",
          "scripts",
          "memoryAtlas2dRuntime.ts",
        ),
        "memory-atlas-3d": path.join(
          process.cwd(),
          "custom",
          "components",
          "scripts",
          "memoryAtlas3dRuntime.ts",
        ),
      },
      bundle: true,
      format: "esm",
      platform: "browser",
      target: ["es2022"],
      minify: true,
      outdir: "memory-atlas-assets",
      write: false,
    })

    let emittedRuntimeCount = 0
    for (const output of result.outputFiles) {
      const name = path.basename(output.path, ".js")
      if (name !== "memory-atlas-2d" && name !== "memory-atlas-3d") continue
      yield write({
        ctx,
        slug: joinSegments("static", name) as FullSlug,
        ext: ".js",
        content: Buffer.from(output.contents),
      })
      emittedRuntimeCount += 1
    }
    if (emittedRuntimeCount !== 2) {
      throw new Error(`expected 2 Memory Atlas runtime bundles, emitted ${emittedRuntimeCount}`)
    }

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
