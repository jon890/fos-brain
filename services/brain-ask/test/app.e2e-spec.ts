import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cookiePair,
  PROCESS_FIXTURE,
  ProductionFixture,
} from "./process-test-helpers.js";

describe("production Nest process authentication and question flow", () => {
  let fixture: ProductionFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it("moves from public to admin, revokes logout, and drops sessions on restart", async () => {
    fixture = await ProductionFixture.create();
    const publicSession = await fixture.process.request("/api/auth/session");
    expect(publicSession.status).toBe(200);
    expect(publicSession.body).toEqual({ role: "public", expiresAt: null });

    const protectedIndex = await fixture.process.request("/api/private/content-index");
    expect(protectedIndex.status).toBe(401);
    expect(protectedIndex.body).toEqual({ error: { code: "authentication_required" } });
    const publicQuestion = await fixture.process.request("/api/brain/ask", {
      method: "POST",
      headers: { Origin: fixture.process.origin },
      body: { question: "private process question sentinel" },
    });
    expect(publicQuestion.status).toBe(401);

    const login = await fixture.process.request("/api/auth/login", {
      method: "POST",
      headers: { Origin: fixture.process.origin },
      body: { password: PROCESS_FIXTURE.password },
    });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ role: "admin", expiresAt: expect.any(String) });
    const cookie = cookiePair(login);

    const adminIndex = await fixture.process.request("/api/private/content-index", {
      headers: { Cookie: cookie },
    });
    expect(adminIndex.status).toBe(200);
    expect(adminIndex.body).toEqual({ nodes: [{ slug: "private" }] });
    const adminQuestion = await fixture.process.request("/api/brain/ask", {
      method: "POST",
      headers: { Origin: fixture.process.origin, Cookie: cookie },
      body: { question: "private process question sentinel" },
    });
    expect(adminQuestion.status).toBe(200);
    expect(adminQuestion.body).toMatchObject({
      answer: PROCESS_FIXTURE.privateAnswer,
      sources: [
        {
          title: PROCESS_FIXTURE.privateTitle,
          slug: "entities/style",
          namespace: "private",
          excerpt: PROCESS_FIXTURE.privateExcerpt,
          href: "/_private/entities/style",
        },
      ],
    });

    const logout = await fixture.process.request("/api/auth/logout", {
      method: "POST",
      headers: { Origin: fixture.process.origin, Cookie: cookie },
    });
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    const afterLogout = await fixture.process.request("/api/private/content-index", {
      headers: { Cookie: cookie },
    });
    expect(afterLogout.status).toBe(401);

    const secondLogin = await fixture.process.request("/api/auth/login", {
      method: "POST",
      headers: { Origin: fixture.process.origin },
      body: { password: PROCESS_FIXTURE.password },
    });
    const cookieBeforeRestart = cookiePair(secondLogin);
    await fixture.restart();
    const sessionAfterRestart = await fixture.process.request("/api/auth/session", {
      headers: { Cookie: cookieBeforeRestart },
    });
    expect(sessionAfterRestart.body).toEqual({ role: "public", expiresAt: null });
    const protectedAfterRestart = await fixture.process.request("/api/private/content-index", {
      headers: { Cookie: cookieBeforeRestart },
    });
    expect(protectedAfterRestart.status).toBe(401);
  });

  it("rejects a multi-line model API key before the process becomes ready", async () => {
    const keyRoot = await fs.mkdtemp(path.join(os.tmpdir(), "brain-ask-multiline-key-"));
    const keyFile = path.join(keyRoot, "model-key");
    await fs.writeFile(keyFile, "first-key\nsecond-key\n", { mode: 0o600 });
    try {
      await expect(ProductionFixture.create({ MODEL_API_KEY_FILE: keyFile })).rejects.toThrow(
        /MODEL_API_KEY_FILE must contain exactly one line/,
      );
    } finally {
      await fs.rm(keyRoot, { recursive: true, force: true });
    }
  });
});
