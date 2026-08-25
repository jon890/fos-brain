import esbuild from "esbuild"
import path from "path"
import { FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"

export const MemoryAtlasAssets: QuartzEmitterPlugin = () => ({
  name: "MemoryAtlasAssets",
  async *emit(ctx) {
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
  },
})
