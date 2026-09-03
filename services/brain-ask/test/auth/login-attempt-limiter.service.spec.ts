import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginAttemptLimiter } from "../../src/auth/login-attempt-limiter.service.js";

describe("LoginAttemptLimiter", () => {
  afterEach(() => vi.useRealTimers());

  it("allows five attempts per client in fifteen minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    const limiter = new LoginAttemptLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.consume("client")).toBe(true);
    }
    expect(limiter.consume("client")).toBe(false);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(limiter.consume("client")).toBe(true);
  });

  it("keeps at most 1,024 clients and evicts the oldest", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    const limiter = new LoginAttemptLimiter();
    for (let index = 0; index < 1_025; index += 1) {
      limiter.consume(`client-${index}`);
      vi.advanceTimersByTime(1);
    }
    const clients = Reflect.get(limiter, "clients") as Map<string, unknown>;
    expect(limiter.size).toBe(1_024);
    expect(clients.has("client-0")).toBe(false);
    expect(clients.has("client-1024")).toBe(true);
  });
});
