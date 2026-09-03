import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { QmdClient, QmdPayload, QmdResult, QmdSearchRequest } from "./contracts.js";
import { FETCH_IMPL, type FetchImplementation } from "./tokens.js";

const COLLECTIONS = ["brain-wiki", "brain-private"] as const;

function resultUris(value: unknown, output: string[] = []): string[] {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    for (const item of value) resultUris(item, output);
    return output;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["uri", "url", "file", "id", "resource"] as const) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.startsWith("qmd://")) {
      output.push(candidate);
    }
  }
  for (const nested of Object.values(record)) resultUris(nested, output);
  return output;
}

@Injectable()
export class HttpQmdClient implements QmdClient {
  constructor(
    private readonly config: ConfigService,
    @Inject(FETCH_IMPL) private readonly fetchImpl: FetchImplementation,
  ) {}

  async search({ question, signal }: QmdSearchRequest): Promise<QmdPayload | QmdResult[]> {
    const baseUrl = this.config.getOrThrow<string>("BRAIN_QMD_URL").replace(/\/+$/, "");
    const response = await this.fetchImpl(`${baseUrl}/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        searches: [
          { type: "lex", query: question },
          { type: "vec", query: question },
        ],
        collections: COLLECTIONS,
        limit: 6,
        rerank: false,
      }),
      signal,
    });
    if (!response.ok) throw new Error(`brain-qmd returned HTTP ${response.status}`);

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error("brain-qmd returned invalid JSON");
    }
    const allowed = new Set<string>(COLLECTIONS);
    for (const uri of resultUris(payload)) {
      const collection = /^qmd:\/\/([^/]+)\//.exec(uri)?.[1];
      if (collection && !allowed.has(collection)) {
        throw new Error(`brain-qmd returned a result from disallowed collection: ${collection}`);
      }
    }
    if (!payload || typeof payload !== "object") return [];
    return payload as QmdPayload | QmdResult[];
  }
}
