import fs from "node:fs/promises";
import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpModelClient } from "../src/brain-ask/model.client.js";
import { HttpQmdClient } from "../src/brain-ask/qmd.client.js";
import type { FetchImplementation } from "../src/brain-ask/tokens.js";
import { createTempBrain, type TempBrain } from "./test-helpers.js";

describe("upstream clients", () => {
  let brain: TempBrain | undefined;

  afterEach(async () => {
    if (brain) await fs.rm(brain.root, { recursive: true, force: true });
    brain = undefined;
  });

  it("sends the fixed qmd search contract and rejects foreign collections", async () => {
    const fetchMock = vi.fn<FetchImplementation>();
    fetchMock.mockResolvedValueOnce(
      Response.json({ results: [{ uri: "qmd://brain-wiki/concepts/agent.md" }] }),
    );
    const client = new HttpQmdClient(
      new ConfigService({ BRAIN_QMD_URL: "http://127.0.0.1:8181/" }),
      fetchMock,
    );
    const controller = new AbortController();
    await expect(client.search({ question: "question", signal: controller.signal })).resolves.toEqual({
      results: [{ uri: "qmd://brain-wiki/concepts/agent.md" }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8181/query",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          searches: [
            { type: "lex", query: "question" },
            { type: "vec", query: "question" },
          ],
          collections: ["brain-wiki", "brain-private"],
          limit: 6,
          rerank: false,
        }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      Response.json({ results: [{ uri: "qmd://brain-raw/source.md" }] }),
    );
    await expect(client.search({ question: "question", signal: controller.signal })).rejects.toThrow(
      /disallowed collection/,
    );
  });

  it("loads the key at startup and preserves the Responses request contract", async () => {
    brain = await createTempBrain();
    let requestBody: Record<string, any> | undefined;
    const fetchMock: FetchImplementation = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, any>;
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-key");
      return Response.json({ status: "completed", output_text: "x".repeat(30) });
    };
    const client = new HttpModelClient(
      new ConfigService({
        MODEL_API_KEY_FILE: brain.keyFile,
        MODEL_API_BASE_URL: "http://127.0.0.1:8182/",
        MODEL_NAME: "brain",
        MODEL_MAX_OUTPUT_TOKENS: 12,
        MODEL_MAX_RESPONSE_BYTES: 1536,
        BRAIN_ASK_MAX_ANSWER_CHARS: 20,
      }),
      fetchMock,
    );
    await client.onModuleInit();
    await expect(
      client.answer({ question: "question", context: "context", signal: new AbortController().signal }),
    ).resolves.toBe("x".repeat(20));
    expect(requestBody).toMatchObject({ model: "brain", store: false, max_output_tokens: 12 });
    expect(requestBody).not.toHaveProperty("previous_response_id");
    expect(requestBody).not.toHaveProperty("conversation");
    expect(requestBody).not.toHaveProperty("tools");
  });

  it("rejects oversized, invalid and function-call model responses", async () => {
    brain = await createTempBrain();
    const config = new ConfigService({
      MODEL_API_KEY_FILE: brain.keyFile,
      MODEL_API_BASE_URL: "http://127.0.0.1:8182",
      MODEL_NAME: "brain",
      MODEL_MAX_OUTPUT_TOKENS: 12,
      MODEL_MAX_RESPONSE_BYTES: 64,
      BRAIN_ASK_MAX_ANSWER_CHARS: 20,
    });
    const payloads = [
      new Response("x".repeat(65)),
      new Response("not-json"),
      Response.json({ status: "completed", output: [{ type: "function_call" }] }),
    ];
    const client = new HttpModelClient(config, async () => payloads.shift()!);
    await client.onModuleInit();
    for (const expected of ["too large", "invalid JSON", "function_call"]) {
      await expect(
        client.answer({
          question: "question",
          context: "context",
          signal: new AbortController().signal,
        }),
      ).rejects.toThrow(expected);
    }
  });

  it("fails initialization when the key file is empty", async () => {
    brain = await createTempBrain();
    await fs.writeFile(brain.keyFile, "\n");
    const client = new HttpModelClient(
      new ConfigService({ MODEL_API_KEY_FILE: brain.keyFile }),
      async () => Response.json({}),
    );
    await expect(client.onModuleInit()).rejects.toThrow(/must contain a key/);
  });

  it("uses the public model error code for HTTP failures", async () => {
    brain = await createTempBrain();
    const client = new HttpModelClient(
      new ConfigService({
        MODEL_API_KEY_FILE: brain.keyFile,
        MODEL_API_BASE_URL: "http://127.0.0.1:8182",
        MODEL_NAME: "brain",
        MODEL_MAX_OUTPUT_TOKENS: 12,
      }),
      async () => new Response("", { status: 503 }),
    );
    await client.onModuleInit();
    await expect(
      client.answer({ question: "question", context: "context", signal: new AbortController().signal }),
    ).rejects.toMatchObject({ code: "model_unavailable" });
  });
});
