import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  escapeEvidenceAttribute,
  normalizeQmdResults,
  parseQmdUri,
  selectEvidence,
} from "../src/brain-ask/evidence.js";
import { extractOutputText } from "../src/brain-ask/model.client.js";
import { createTempBrain, type TempBrain } from "./test-helpers.js";

describe("brain evidence domain", () => {
  let brain: TempBrain | undefined;

  afterEach(async () => {
    if (brain) await fs.rm(brain.root, { recursive: true, force: true });
    brain = undefined;
  });

  it("allows wiki collections and rejects traversal, raw, absolute and symlink escape", async () => {
    brain = await createTempBrain();
    const roots = { publicWikiRoot: brain.publicWiki, privateWikiRoot: brain.privateWiki };
    expect(parseQmdUri("qmd://brain-wiki/concepts/agent.md", roots)).toEqual({
      namespace: "public",
      relativePath: "concepts/agent.md",
      slug: "concepts/agent",
      href: "/concepts/agent",
      absolutePath: await fs.realpath(path.join(brain.publicWiki, "concepts", "agent.md")),
    });
    expect(parseQmdUri("qmd://brain-private/entities/style.md", roots).href).toBe(
      "/_private/entities/style",
    );
    expect(() => parseQmdUri("qmd://brain-raw/source.md", roots)).toThrow(/not allowed/);
    expect(() => parseQmdUri("qmd://brain-wiki/../secret.md", roots)).toThrow(/escapes/);
    expect(() => parseQmdUri("qmd://brain-wiki/%2Fetc/passwd", roots)).toThrow(/relative/);

    const outside = path.join(brain.root, "outside.md");
    await fs.writeFile(outside, "outside");
    await fs.symlink(outside, path.join(brain.publicWiki, "concepts", "outside.md"));
    expect(() => parseQmdUri("qmd://brain-wiki/concepts/outside.md", roots)).toThrow(/outside/);
  });

  it("preserves qmd order and caps file and total context size", async () => {
    brain = await createTempBrain();
    for (let index = 0; index < 7; index += 1) {
      await fs.writeFile(path.join(brain.publicWiki, `doc-${index}.md`), "a".repeat(10 * 1024));
    }
    const normalized = normalizeQmdResults(
      {
        results: Array.from({ length: 7 }, (_, index) => ({
          uri: `qmd://brain-wiki/doc-${index}.md`,
          title: `Doc ${index}`,
          score: 1 - index / 10,
          excerpt: `excerpt-${index}`,
        })),
      },
      { publicWikiRoot: brain.publicWiki, privateWikiRoot: brain.privateWiki },
    );
    const { context, sources } = await selectEvidence(normalized, async (file) =>
      fs.readFile(file, "utf8"),
    );
    expect(sources.map((source) => source.title)).toEqual(["Doc 0", "Doc 1", "Doc 2", "Doc 3"]);
    expect(context.match(/<evidence index=/g)).toHaveLength(4);
    expect(context.split("a".repeat(8192))).toHaveLength(5);
    expect(context).not.toContain("doc-4");
  });

  it("escapes evidence attributes without changing returned source slugs", async () => {
    brain = await createTempBrain();
    const unsafeSlug = "concepts/%22%3Cline\n\u0001";
    const normalized = normalizeQmdResults(
      { results: [{ uri: "qmd://brain-wiki/concepts/agent.md", title: "Agent" }] },
      { publicWikiRoot: brain.publicWiki, privateWikiRoot: brain.privateWiki },
    );
    normalized[0]!.slug = unsafeSlug;
    const { context, sources } = await selectEvidence(normalized, async (file) =>
      fs.readFile(file, "utf8"),
    );
    const openingTag = context.split("\n")[0]!;
    expect(sources[0]?.slug).toBe(unsafeSlug);
    expect(openingTag).not.toContain("\n");
    expect(openingTag).not.toContain("\u0001");
    expect(openingTag).toContain("&#xA;");
    expect(openingTag).toContain("&#x1;");
    expect(escapeEvidenceAttribute('quoted" <tag> & value\n\u0001')).toBe(
      "quoted&quot; &lt;tag&gt; &amp; value&#xA;&#x1;",
    );
  });

  it("truncates multibyte evidence on a valid UTF-8 boundary", async () => {
    brain = await createTempBrain();
    await fs.writeFile(path.join(brain.publicWiki, "multibyte.md"), "가".repeat(4096));
    const normalized = normalizeQmdResults(
      { results: [{ uri: "qmd://brain-wiki/multibyte.md" }] },
      { publicWikiRoot: brain.publicWiki, privateWikiRoot: brain.privateWiki },
    );
    const { context } = await selectEvidence(normalized, async (file) => fs.readFile(file, "utf8"));
    const body = />\n([\s\S]*)\n<\/evidence>/.exec(context)?.[1] ?? "";
    expect(Buffer.byteLength(body, "utf8")).toBeLessThanOrEqual(8 * 1024);
    expect(body).not.toMatch(/\uFFFD$/);
  });

  it("only extracts text from completed Responses output", () => {
    expect(extractOutputText({ status: "in_progress", output_text: "no" })).toBe("");
    expect(extractOutputText({ status: "completed", output_text: "plain" })).toBe("plain");
    expect(
      extractOutputText({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "hello " },
              { type: "text", text: "world" },
            ],
          },
          { type: "function_call", name: "search" },
        ],
      }),
    ).toBe("hello world");
  });
});
