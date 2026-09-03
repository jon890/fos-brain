import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  cookiePair,
  PROCESS_FIXTURE,
  ProductionFixture,
} from "./process-test-helpers.js";

describe("production Nest process security boundary", () => {
  let fixture: ProductionFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it("sets hardened headers, rejects cross-origin input, and redacts request data from logs", async () => {
    fixture = await ProductionFixture.create();
    const health = await fixture.process.request("/api/health", {
      headers: { Origin: "https://attacker.example" },
    });
    expect(health.status).toBe(200);
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    expect(health.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(health.headers.get("access-control-allow-origin")).toBeNull();

    const publicSession = await fixture.process.request("/api/auth/session");
    expect(publicSession.headers.get("cache-control")).toBe("private, no-store");
    expect(publicSession.headers.get("access-control-allow-origin")).toBeNull();

    const missingOrigin = await fixture.process.request("/api/auth/login", {
      method: "POST",
      body: { password: "missing origin password sentinel" },
    });
    expect(missingOrigin.status).toBe(403);
    expect(missingOrigin.body).toEqual({ error: { code: "origin_rejected" } });
    const foreignOrigin = await fixture.process.request("/api/auth/login", {
      method: "POST",
      headers: { Origin: "https://attacker.example" },
      body: { password: "foreign origin password sentinel" },
    });
    expect(foreignOrigin.status).toBe(403);
    const invalidLogin = await fixture.process.request("/api/auth/login", {
      method: "POST",
      headers: { Origin: fixture.process.origin },
      body: { password: "", role: "admin", leaked: "invalid login sentinel" },
    });
    expect(invalidLogin.status).toBe(400);
    expect(invalidLogin.body).toEqual({ error: { code: "invalid_login" } });

    const login = await fixture.process.request("/api/auth/login", {
      method: "POST",
      headers: { Origin: fixture.process.origin },
      body: { password: PROCESS_FIXTURE.password },
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("__Host-brain_session=");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).not.toContain("Domain=");
    const cookie = cookiePair(login);

    const invalidQuestion = await fixture.process.request("/api/brain/ask", {
      method: "POST",
      headers: { Origin: fixture.process.origin, Cookie: cookie },
      body: { question: "", leaked: "invalid body sentinel" },
    });
    expect(invalidQuestion.status).toBe(400);
    expect(invalidQuestion.headers.get("cache-control")).toBe("private, no-store");
    const answered = await fixture.process.request("/api/brain/ask", {
      method: "POST",
      headers: { Origin: fixture.process.origin, Cookie: cookie },
      body: { question: "private process question sentinel" },
    });
    expect(answered.status).toBe(200);
    expect(answered.headers.get("cache-control")).toBe("private, no-store");
    await delay(25);

    const sessionId = cookie.slice(cookie.indexOf("=") + 1);
    for (const secret of [
      PROCESS_FIXTURE.password,
      sessionId,
      "missing origin password sentinel",
      "foreign origin password sentinel",
      "invalid body sentinel",
      "invalid login sentinel",
      "private process question sentinel",
      PROCESS_FIXTURE.privateAnswer,
      PROCESS_FIXTURE.privateExcerpt,
      "private body",
      "fixture-key",
    ]) {
      expect(fixture.process.logs).not.toContain(secret);
    }
    expect(fixture.process.logs).toContain('"requestId"');
    expect(fixture.process.logs).toContain('"status":200');
  });

  it("rate limits repeated credentials without trusting forwarded client addresses", async () => {
    fixture = await ProductionFixture.create();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fixture.process.request("/api/auth/login", {
        method: "POST",
        headers: {
          Origin: fixture.process.origin,
          "X-Forwarded-For": `198.51.100.${attempt + 1}`,
        },
        body: { password: `wrong password ${attempt}` },
      });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: { code: "invalid_credentials" } });
    }
    const limited = await fixture.process.request("/api/auth/login", {
      method: "POST",
      headers: {
        Origin: fixture.process.origin,
        "X-Forwarded-For": "203.0.113.20",
      },
      body: { password: "wrong password limited" },
    });
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { code: "login_rate_limited" } });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(Number(limited.headers.get("retry-after"))).toBeLessThanOrEqual(15 * 60);
  });
});
