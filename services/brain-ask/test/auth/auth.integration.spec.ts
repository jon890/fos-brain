import fs from "node:fs/promises";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request, { type Response as SupertestResponse } from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordHashService } from "../../src/auth/password-hash.service.js";
import { AuthModule } from "../../src/auth/auth.module.js";
import { BrainAskModule } from "../../src/brain-ask/brain-ask.module.js";
import type { ModelClient, QmdClient } from "../../src/brain-ask/contracts.js";
import { MODEL_CLIENT, QMD_CLIENT } from "../../src/brain-ask/tokens.js";
import { AppConfigModule } from "../../src/config/app-config.module.js";
import { configureApplication } from "../../src/configure-application.js";
import { PrivateContentModule } from "../../src/private-content/private-content.module.js";
import {
  createTempBrain,
  setTestEnvironment,
  TEST_ADMIN_PASSWORD,
  TEST_BRAIN_ORIGIN,
  type TempBrain,
} from "../test-helpers.js";

function firstSetCookie(response: SupertestResponse): string {
  const values = response.headers["set-cookie"] as unknown;
  return Array.isArray(values) ? String(values[0]) : String(values);
}

function cookiePair(response: SupertestResponse): string {
  return firstSetCookie(response).split(";", 1)[0]!;
}

describe("administrator authentication boundary", () => {
  let app: INestApplication | undefined;
  let brain: TempBrain | undefined;
  let qmdCalls: number;

  beforeEach(async () => {
    brain = await createTempBrain();
    setTestEnvironment(brain);
    qmdCalls = 0;
    const qmd: QmdClient = {
      async search() {
        qmdCalls += 1;
        return {
          results: [
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
      async answer() {
        return "관리자 답변";
      },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule.register(), AuthModule, BrainAskModule, PrivateContentModule],
    })
      .overrideProvider(PasswordHashService)
      .useValue({ verify: (password: string) => Promise.resolve(password === TEST_ADMIN_PASSWORD) })
      .overrideProvider(QMD_CLIENT)
      .useValue(qmd)
      .overrideProvider(MODEL_CLIENT)
      .useValue(model)
      .compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApplication(app);
    await app.init();
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (app) await app.close();
    if (brain) await fs.rm(brain.root, { recursive: true, force: true });
    app = undefined;
    brain = undefined;
  });

  const login = (password = TEST_ADMIN_PASSWORD) =>
    request(app!.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .send({ password });

  it("rejects missing, referer-only and mismatched origins before authentication", async () => {
    for (const operation of [
      () => request(app!.getHttpServer()).post("/api/auth/login").send({ password: "wrong" }),
      () => request(app!.getHttpServer()).post("/api/auth/login").set("content-type", "text/plain"),
      () =>
        request(app!.getHttpServer())
          .post("/api/auth/login")
          .set("Referer", `${TEST_BRAIN_ORIGIN}/login`)
          .send({ password: "wrong" }),
      () =>
        request(app!.getHttpServer())
          .post("/api/auth/login")
          .set("Origin", "https://attacker.example")
          .send({ password: "wrong" }),
    ]) {
      const response = await operation().expect(403, { error: { code: "origin_rejected" } });
      expect(response.headers["cache-control"]).toBe("private, no-store");
    }
  });

  it("returns bounded login validation and indistinguishable credential failures", async () => {
    await request(app!.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .send({ password: "", role: "admin" })
      .expect(400, { error: { code: "invalid_login" } });
    const first = await login("wrong one").expect(401);
    const second = await login("wrong two").expect(401);
    expect(first.body).toEqual({ error: { code: "invalid_credentials" } });
    expect(second.body).toEqual(first.body);
  });

  it("issues the host-only secure cookie and serves session, authorize and fixed private files", async () => {
    await request(app!.getHttpServer())
      .get("/api/auth/session")
      .expect(200, { role: "public", expiresAt: null });
    const response = await login().expect(200);
    expect(response.body).toMatchObject({ role: "admin", expiresAt: expect.any(String) });
    const setCookie = firstSetCookie(response);
    expect(setCookie).toContain("__Host-brain_session=");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).not.toContain("Domain=");
    const cookie = cookiePair(response);

    await request(app!.getHttpServer())
      .get("/api/auth/session")
      .set("Cookie", cookie)
      .expect(200, { role: "admin", expiresAt: response.body.expiresAt });
    await request(app!.getHttpServer()).get("/api/auth/authorize").set("Cookie", cookie).expect(204);
    await request(app!.getHttpServer())
      .get("/api/private/content-index?path=/etc/passwd")
      .set("Cookie", cookie)
      .expect(200, { nodes: [{ slug: "private" }] });
    await request(app!.getHttpServer())
      .get("/api/private/memory-atlas-semantics")
      .set("Cookie", cookie)
      .expect(200, { schemaVersion: 1, edges: [] });
  });

  it("ignores forged roles, headers, bodies and cookies before upstream work", async () => {
    await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .send({ question: "보호 질문" })
      .expect(403, { error: { code: "origin_rejected" } });
    await request(app!.getHttpServer())
      .get("/api/private/content-index")
      .set("x-brain-role", "admin")
      .set("Cookie", "__Host-brain_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
      .expect(401, { error: { code: "authentication_required" } });
    await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .set("x-brain-role", "admin")
      .send({ question: "보호 질문", role: "admin" })
      .expect(401, { error: { code: "authentication_required" } });
    expect(qmdCalls).toBe(0);
  });

  it("allows the question contract only with an administrator session", async () => {
    const cookie = cookiePair(await login().expect(200));
    const response = await request(app!.getHttpServer())
      .post("/api/brain/ask")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .set("Cookie", cookie)
      .send({ question: "보호 질문" })
      .expect(200);
    expect(response.body).toMatchObject({ answer: "관리자 답변", sources: expect.any(Array) });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(qmdCalls).toBe(1);
  });

  it("logs out idempotently and clears the session cookie", async () => {
    const cookie = cookiePair(await login().expect(200));
    const logout = await request(app!.getHttpServer())
      .post("/api/auth/logout")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .set("Cookie", cookie)
      .expect(204);
    expect(firstSetCookie(logout)).toContain("Max-Age=0");
    await request(app!.getHttpServer()).get("/api/auth/authorize").set("Cookie", cookie).expect(401);
    await request(app!.getHttpServer())
      .post("/api/auth/logout")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .expect(204);
  });

  it("limits the untrusted direct client even when forwarded addresses are forged", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app!.getHttpServer())
        .post("/api/auth/login")
        .set("Origin", TEST_BRAIN_ORIGIN)
        .set("X-Forwarded-For", `198.51.100.${attempt + 1}`)
        .send({ password: "wrong" })
        .expect(401);
    }
    await request(app!.getHttpServer())
      .post("/api/auth/login")
      .set("Origin", TEST_BRAIN_ORIGIN)
      .set("X-Forwarded-For", "203.0.113.20")
      .send({ password: "wrong" })
      .expect(429, { error: { code: "login_rate_limited" } });
  });

  it("fails closed when a configured private file disappears", async () => {
    const cookie = cookiePair(await login().expect(200));
    await fs.rm(brain!.privateContentIndexFile);
    const response = await request(app!.getHttpServer())
      .get("/api/private/content-index")
      .set("Cookie", cookie)
      .expect(503, { error: { code: "private_content_unavailable" } });
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
});
