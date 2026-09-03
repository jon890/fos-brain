import fs from "node:fs/promises";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { validateEnvironment } from "../src/config/environment.js";
import { configureApplication } from "../src/configure-application.js";
import { createTempBrain, setTestEnvironment, type TempBrain } from "./test-helpers.js";

describe("production application boundary", () => {
  let app: INestApplication | undefined;
  let brain: TempBrain | undefined;

  afterEach(async () => {
    if (app) await app.close();
    if (brain) await fs.rm(brain.root, { recursive: true, force: true });
    app = undefined;
    brain = undefined;
  });

  it("exposes health but keeps the question route fail-closed", async () => {
    brain = await createTempBrain();
    setTestEnvironment(brain);
    const { AppModule } = await import("../src/app.module.js");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApplication(app, { enableBrainAskRoute: false });
    await app.init();
    await request(app.getHttpServer()).get("/api/health").expect(200, { ok: true });
    await request(app.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "must remain unavailable" })
      .expect(404);
  });

  it("validates required settings and numeric ranges before startup", () => {
    expect(() => validateEnvironment({})).toThrow(/Invalid brain-ask configuration/);
    expect(() =>
      validateEnvironment({
        BRAIN_QMD_URL: "http://127.0.0.1:8181",
        MODEL_API_BASE_URL: "http://127.0.0.1:8182",
        MODEL_API_KEY_FILE: "/fixture/key",
        BRAIN_PUBLIC_WIKI_ROOT: "/fixture/public",
        BRAIN_PRIVATE_WIKI_ROOT: "/fixture/private",
        BRAIN_QMD_TIMEOUT_MS: "0",
      }),
    ).toThrow(/Invalid brain-ask configuration/);
    expect(() =>
      validateEnvironment({
        BRAIN_QMD_URL: "http://127.0.0.1:8181",
        MODEL_API_BASE_URL: "http://127.0.0.1:8182",
        MODEL_API_KEY_FILE: "/fixture/key",
        BRAIN_PUBLIC_WIKI_ROOT: "/fixture/public",
        BRAIN_PRIVATE_WIKI_ROOT: "/fixture/private",
        PORT: "",
      }),
    ).toThrow(/PORT must be an integer/);
  });
});
