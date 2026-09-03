import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionStoreService } from "../../src/auth/session-store.service.js";

describe("SessionStoreService", () => {
  afterEach(() => vi.useRealTimers());

  it("stores only digests and removes expired sessions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    const store = new SessionStoreService();
    const created = store.create();
    const sessions = Reflect.get(store, "sessions") as Map<string, unknown>;
    expect(created.id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect([...sessions.keys()]).toEqual([
      createHash("sha256").update(created.id).digest("hex"),
    ]);
    expect([...sessions.keys()]).not.toContain(created.id);
    expect(store.find(created.id)?.role).toBe("admin");

    vi.setSystemTime(created.expiresAt);
    expect(store.find(created.id)).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it("evicts the oldest session at eight and does not restore state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
    const store = new SessionStoreService();
    const ids: string[] = [];
    for (let index = 0; index < 9; index += 1) {
      vi.advanceTimersByTime(1);
      ids.push(store.create().id);
    }
    expect(store.size).toBe(8);
    expect(store.find(ids[0])).toBeUndefined();
    expect(store.find(ids[8])?.role).toBe("admin");
    expect(new SessionStoreService().find(ids[8])).toBeUndefined();

    store.onApplicationShutdown();
    expect(store.size).toBe(0);
  });
});
