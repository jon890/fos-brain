import fs from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrainAskError } from "../src/brain-ask/brain-ask.errors.js";
import { BrainAskModule } from "../src/brain-ask/brain-ask.module.js";
import { BrainAskService } from "../src/brain-ask/brain-ask.service.js";
import type { ModelClient, QmdClient } from "../src/brain-ask/contracts.js";
import { MODEL_CLIENT, QMD_CLIENT } from "../src/brain-ask/tokens.js";
import { AppConfigModule } from "../src/config/app-config.module.js";
import { configureApplication } from "../src/configure-application.js";
import { createTempBrain, setTestEnvironment, type TempBrain } from "./test-helpers.js";

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function delayedPost(port: number, body: unknown, delayMs: number) {
  return new Promise<{ status: number; body: Record<string, any> }>((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request(
      {
        method: "POST",
        host: "127.0.0.1",
        port,
        path: "/api/brain/ask",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(data),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, any>,
          });
        });
      },
    );
    request.on("error", reject);
    request.flushHeaders();
    setTimeout(() => request.end(data), delayMs);
  });
}

describe("BrainAskController", () => {
  let app: INestApplication | undefined;
  let brain: TempBrain | undefined;
  let qmdMode: "normal" | "empty" | "slow" | "pending" | "error";
  let modelMode: "normal" | "slow" | "error";
  let modelCalls: number;
  let activeQmdSignal: AbortSignal | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    brain = await createTempBrain();
    setTestEnvironment(brain);
    qmdMode = "normal";
    modelMode = "normal";
    modelCalls = 0;
    activeQmdSignal = undefined;
    const qmd: QmdClient = {
      async search({ signal }) {
        activeQmdSignal = signal;
        if (qmdMode === "slow") await abortableDelay(150, signal);
        if (qmdMode === "pending") await abortableDelay(60_000, signal);
        if (qmdMode === "error") throw new Error("qmd failed");
        return {
          results:
            qmdMode === "empty"
              ? []
              : [
                  {
                    uri: "qmd://brain-wiki/concepts/agent.md",
                    title: "Agent",
                    score: 0.9,
                    excerpt: "public excerpt",
                  },
                ],
        };
      },
    };
    const model: ModelClient = {
      async answer({ signal }) {
        modelCalls += 1;
        if (modelMode === "slow") await abortableDelay(150, signal);
        if (modelMode === "error") throw new BrainAskError("model_unavailable");
        return "근거 기반 답변";
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.register(), BrainAskModule],
    })
      .overrideProvider(QMD_CLIENT)
      .useValue(qmd)
      .overrideProvider(MODEL_CLIENT)
      .useValue(model)
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApplication(app, { enableBrainAskRoute: true });
    await app.init();
    logSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    logSpy?.mockRestore();
    if (app) await app.close();
    if (brain) await fs.rm(brain.root, { recursive: true, force: true });
  });

  it("returns a grounded answer and preserves source shape", async () => {
    const response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .set("content-type", "application/json; charset=utf-8")
      .send({ question: "  내 작업 방식?  " })
      .expect(200);
    expect(response.body.requestId).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.answer).toBe("근거 기반 답변");
    expect(response.body.sources).toEqual([
      {
        title: "Agent",
        slug: "concepts/agent",
        namespace: "public",
        score: 0.9,
        excerpt: "public excerpt",
        href: "/concepts/agent",
      },
    ]);
  });

  it("does not call the model for empty evidence", async () => {
    qmdMode = "empty";
    const response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "없는 질문" })
      .expect(200);
    expect(response.body.answer).toBe("");
    expect(response.body.sources).toEqual([]);
    expect(modelCalls).toBe(0);
  });

  it("returns the legacy validation contract for invalid input, media type and size", async () => {
    for (const send of [
      () => request(app!.getHttpServer()).post("/api/brain/ask").send({ question: "" }),
      () => request(app!.getHttpServer()).post("/api/brain/ask").send([]),
      () =>
        request(app!.getHttpServer())
          .post("/api/brain/ask")
          .set("content-type", "application/json")
          .send("{"),
      () =>
        request(app!.getHttpServer())
          .post("/api/brain/ask")
          .set("content-type", "text/plain")
          .send(JSON.stringify({ question: "wrong media type" })),
      () =>
        request(app!.getHttpServer())
          .post("/api/brain/ask")
          .send({ question: "x".repeat(5 * 1024) }),
    ]) {
      const response = await send().expect(400);
      expect(response.body.requestId).toEqual(expect.any(String));
      expect(response.body.error).toEqual({
        code: "invalid_question",
        message: "Question must be a JSON string from 1 to 500 characters.",
        retryable: false,
      });
      expect(response.headers["cache-control"]).toBe("no-store");
    }
  });

  it("does not let a slow request body acquire the single-request lock", async () => {
    await app!.listen(0, "127.0.0.1");
    const port = (app!.getHttpServer().address() as AddressInfo).port;
    const [slowBody, normalBody] = await Promise.all([
      delayedPost(port, { question: "느린 본문" }, 80),
      request(app!.getHttpServer()).post("/api/brain/ask").send({ question: "정상 본문" }),
    ]);
    expect(slowBody.status).toBe(400);
    expect(slowBody.body.error.code).toBe("invalid_question");
    expect(normalBody.status).toBe(200);
  });

  it("limits concurrent questions to one", async () => {
    qmdMode = "slow";
    const responses = await Promise.all([
      request(app!.getHttpServer()).post("/api/brain/ask").send({ question: "느린 질문" }),
      request(app!.getHttpServer()).post("/api/brain/ask").send({ question: "동시 질문" }),
    ]);
    expect(responses.map((response) => response.status)).toContain(429);
    expect(responses.find((response) => response.status === 429)?.body.error).toMatchObject({
      code: "busy",
      retryable: true,
    });
  });

  it("maps retrieval, model and timeout failures", async () => {
    qmdMode = "error";
    let response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "qmd 장애" })
      .expect(502);
    expect(response.body.error.code).toBe("retrieval_unavailable");

    qmdMode = "slow";
    response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "qmd 시간 초과" })
      .expect(502);
    expect(response.body.error.code).toBe("retrieval_unavailable");

    qmdMode = "normal";
    modelMode = "error";
    response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "모델 장애" })
      .expect(502);
    expect(response.body.error.code).toBe("model_unavailable");

    modelMode = "slow";
    response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "모델 시간 초과" })
      .expect(504);
    expect(response.body.error.code).toBe("model_timeout");
  });

  it("does not log questions, answers, evidence or keys", async () => {
    await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "내 작업 방식?" })
      .expect(200);
    const output = logSpy.mock.calls.map((call: unknown[]) => String(call[0])).join("");
    expect(output).not.toContain("내 작업 방식");
    expect(output).not.toContain("근거 기반 답변");
    expect(output).not.toContain("public excerpt");
    expect(output).not.toContain("fixture-key");
    expect(output).toContain("requestId");
  });

  it("aborts an active upstream request during application shutdown", async () => {
    qmdMode = "pending";
    const service = app!.get(BrainAskService);
    const pending = service.ask("종료 중 질문");
    await vi.waitFor(() => expect(activeQmdSignal).toBeDefined());
    service.onApplicationShutdown();
    expect(activeQmdSignal?.aborted).toBe(true);
    await expect(pending).rejects.toMatchObject({ status: 502 });
  });
});
