import fs from "node:fs/promises";
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrainAskError } from "./brain-ask.errors.js";
import type { ModelAnswerRequest, ModelClient } from "./contracts.js";
import { FETCH_IMPL, type FetchImplementation } from "./tokens.js";

const INSTRUCTIONS =
  "제공된 <evidence> 근거 안에서만 한국어 평문으로 답하세요. 근거가 부족하면 모른다고 답하세요. 도구를 호출하지 마세요.";

export function extractOutputText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const record = response as Record<string, unknown>;
  if (record.status && record.status !== "completed") return "";
  if (typeof record.output_text === "string") return record.output_text;
  if (!Array.isArray(record.output)) return "";

  const texts: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const outputItem = item as Record<string, unknown>;
    if (outputItem.type === "function_call") continue;
    if (!Array.isArray(outputItem.content)) continue;
    for (const part of outputItem.content) {
      if (!part || typeof part !== "object") continue;
      const outputPart = part as Record<string, unknown>;
      if (
        (outputPart.type === "output_text" || outputPart.type === "text") &&
        typeof outputPart.text === "string"
      ) {
        texts.push(outputPart.text);
      }
    }
  }
  return texts.join("");
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) {
      throw new BrainAskError("model_unavailable", "Model API response is too large");
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BrainAskError("model_unavailable", "Model API response is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

@Injectable()
export class HttpModelClient implements ModelClient, OnModuleInit {
  private apiKey = "";

  constructor(
    private readonly config: ConfigService,
    @Inject(FETCH_IMPL) private readonly fetchImpl: FetchImplementation,
  ) {}

  async onModuleInit(): Promise<void> {
    this.apiKey = (
      await fs.readFile(this.config.getOrThrow<string>("MODEL_API_KEY_FILE"), "utf8")
    ).trim();
    if (!this.apiKey) throw new Error("MODEL_API_KEY_FILE must contain a key");
  }

  async answer({ question, context, signal }: ModelAnswerRequest): Promise<string> {
    const body = {
      model: this.config.getOrThrow<string>("MODEL_NAME"),
      store: false,
      max_output_tokens: this.config.getOrThrow<number>("MODEL_MAX_OUTPUT_TOKENS"),
      instructions: INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `<question>\n${question}\n</question>\n\n<evidence-set>\n${context}\n</evidence-set>`,
            },
          ],
        },
      ],
    };
    const baseUrl = this.config.getOrThrow<string>("MODEL_API_BASE_URL").replace(/\/+$/, "");
    const response = await this.fetchImpl(`${baseUrl}/v1/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      throw new BrainAskError("model_unavailable", `Model API HTTP ${response.status}`);
    }

    const text = await readResponseText(
      response,
      this.config.getOrThrow<number>("MODEL_MAX_RESPONSE_BYTES"),
    );
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new BrainAskError("model_unavailable", "Model API returned invalid JSON");
    }
    if (JSON.stringify(payload).includes('"function_call"')) {
      throw new BrainAskError("model_unavailable", "Model API returned a function_call");
    }
    return extractOutputText(payload).slice(
      0,
      this.config.getOrThrow<number>("BRAIN_ASK_MAX_ANSWER_CHARS"),
    );
  }
}
