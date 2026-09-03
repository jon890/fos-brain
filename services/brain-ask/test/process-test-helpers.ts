import { spawn, type ChildProcessByStdio } from "node:child_process";
import fs from "node:fs/promises";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  createTempBrain,
  TEST_ADMIN_PASSWORD,
  type TempBrain,
} from "./test-helpers.js";

const SERVICE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE_TITLE = "Private Process Fixture";
const PRIVATE_EXCERPT = "private process excerpt sentinel";
const PRIVATE_ANSWER = "private process answer sentinel";
type BrainChildProcess = ChildProcessByStdio<null, Readable, Readable>;

export interface ProcessResponse {
  status: number;
  headers: Headers;
  body: unknown;
  text: string;
}

async function readRequest(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function reservePort(): Promise<number> {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

export class RunningBrainProcess {
  readonly origin: string;
  readonly environment: NodeJS.ProcessEnv;
  private readonly child: BrainChildProcess;
  private readonly exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  private stdout = "";
  private stderr = "";

  private constructor(child: BrainChildProcess, origin: string, environment: NodeJS.ProcessEnv) {
    this.child = child;
    this.origin = origin;
    this.environment = environment;
    this.exit = new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
  }

  static async start(
    brain: TempBrain,
    upstreamOrigin: string,
    overrides: NodeJS.ProcessEnv = {},
  ): Promise<RunningBrainProcess> {
    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      BRAIN_QMD_URL: upstreamOrigin,
      MODEL_API_BASE_URL: upstreamOrigin,
      MODEL_API_KEY_FILE: brain.keyFile,
      BRAIN_PUBLIC_WIKI_ROOT: brain.publicWiki,
      BRAIN_PRIVATE_WIKI_ROOT: brain.privateWiki,
      BRAIN_ADMIN_PASSWORD_HASH_FILE: brain.passwordHashFile,
      BRAIN_PRIVATE_CONTENT_INDEX_FILE: brain.privateContentIndexFile,
      BRAIN_PRIVATE_MEMORY_ATLAS_SEMANTICS_FILE: brain.privateSemanticsFile,
      BRAIN_ORIGIN: origin,
      BRAIN_TRUST_PROXY_HOPS: "0",
      BRAIN_QMD_TIMEOUT_MS: "2000",
      MODEL_TIMEOUT_MS: "2000",
      BRAIN_ASK_BODY_TIMEOUT_MS: "1000",
      MODEL_MAX_OUTPUT_TOKENS: "64",
      MODEL_MAX_RESPONSE_BYTES: "4096",
      BRAIN_ASK_MAX_ANSWER_CHARS: "200",
      MODEL_NAME: "brain",
      ...overrides,
    };
    const child = spawn(process.execPath, [path.join(SERVICE_ROOT, "dist", "main.js")], {
      cwd: SERVICE_ROOT,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const running = new RunningBrainProcess(child, origin, environment);
    try {
      await running.waitUntilReady();
      return running;
    } catch (error) {
      await running.stop();
      throw error;
    }
  }

  get logs(): string {
    return `${this.stdout}\n${this.stderr}`;
  }

  async request(
    route: string,
    options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
  ): Promise<ProcessResponse> {
    const headers = new Headers(options.headers);
    let body: string | undefined;
    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(options.body);
    }
    const response = await fetch(`${this.origin}${route}`, {
      method: options.method ?? "GET",
      headers,
      body,
    });
    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) parsed = JSON.parse(text) as unknown;
    return { status: response.status, headers: response.headers, body: parsed, text };
  }

  async stop(): Promise<{ code: number | null; signal: NodeJS.Signals | null; forced: boolean }> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) {
      return { ...(await this.exit), forced: false };
    }
    this.child.kill("SIGTERM");
    const result = await Promise.race([this.exit, delay(5000).then(() => undefined)]);
    if (result) return { ...result, forced: false };
    this.child.kill("SIGKILL");
    return { ...(await this.exit), forced: true };
  }

  private async waitUntilReady(): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (this.child.exitCode !== null || this.child.signalCode !== null) {
        throw new Error(`brain-ask exited before health was ready:\n${this.logs}`);
      }
      try {
        const response = await fetch(`${this.origin}/api/health`);
        if (response.status === 200) return;
      } catch {
        // The connection is expected to fail until Nest starts listening.
      }
      await delay(50);
    }
    throw new Error(`brain-ask health did not become ready:\n${this.logs}`);
  }
}

export class ProductionFixture {
  readonly brain: TempBrain;
  process: RunningBrainProcess;
  private readonly upstream: http.Server;
  private readonly upstreamOrigin: string;

  private constructor(
    brain: TempBrain,
    upstream: http.Server,
    upstreamOrigin: string,
    process: RunningBrainProcess,
  ) {
    this.brain = brain;
    this.upstream = upstream;
    this.upstreamOrigin = upstreamOrigin;
    this.process = process;
  }

  static async create(overrides: NodeJS.ProcessEnv = {}): Promise<ProductionFixture> {
    const brain = await createTempBrain();
    const upstream = http.createServer(async (request, response) => {
      await readRequest(request);
      if (request.url === "/query") {
        sendJson(response, {
          results: [
            {
              uri: "qmd://brain-private/entities/style.md",
              title: PRIVATE_TITLE,
              score: 0.97,
              excerpt: PRIVATE_EXCERPT,
            },
          ],
        });
        return;
      }
      if (request.url === "/v1/responses") {
        sendJson(response, { status: "completed", output_text: PRIVATE_ANSWER });
        return;
      }
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve, reject) => {
      upstream.once("error", reject);
      upstream.listen(0, "127.0.0.1", resolve);
    });
    const upstreamOrigin = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    try {
      const process = await RunningBrainProcess.start(brain, upstreamOrigin, overrides);
      return new ProductionFixture(brain, upstream, upstreamOrigin, process);
    } catch (error) {
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      await fs.rm(brain.root, { recursive: true, force: true });
      throw error;
    }
  }

  async restart(): Promise<void> {
    const stopped = await this.process.stop();
    if (stopped.forced || (stopped.code !== 0 && stopped.signal !== "SIGTERM")) {
      throw new Error(`brain-ask did not shut down gracefully: ${JSON.stringify(stopped)}`);
    }
    this.process = await RunningBrainProcess.start(this.brain, this.upstreamOrigin);
  }

  async close(): Promise<void> {
    await this.process.stop();
    await new Promise<void>((resolve) => this.upstream.close(() => resolve()));
    await fs.rm(this.brain.root, { recursive: true, force: true });
  }
}

export function cookiePair(response: ProcessResponse): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("response did not set a cookie");
  return setCookie.split(";", 1)[0]!;
}

export const PROCESS_FIXTURE = {
  password: TEST_ADMIN_PASSWORD,
  privateTitle: PRIVATE_TITLE,
  privateExcerpt: PRIVATE_EXCERPT,
  privateAnswer: PRIVATE_ANSWER,
};
