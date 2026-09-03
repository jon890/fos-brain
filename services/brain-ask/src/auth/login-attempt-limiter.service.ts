import { Injectable } from "@nestjs/common";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_CLIENTS = 1_024;

interface LoginAttempt {
  windowStartedAt: number;
  lastAttemptAt: number;
  count: number;
}

@Injectable()
export class LoginAttemptLimiter {
  private readonly clients = new Map<string, LoginAttempt>();

  consume(client: string): boolean {
    const now = Date.now();
    this.removeExpired(now);
    const current = this.clients.get(client);
    if (current) {
      current.lastAttemptAt = now;
      if (current.count >= MAX_ATTEMPTS) return false;
      current.count += 1;
      return true;
    }
    this.clients.set(client, { windowStartedAt: now, lastAttemptAt: now, count: 1 });
    while (this.clients.size > MAX_CLIENTS) this.removeOldest();
    return true;
  }

  retryAfterSeconds(client: string): number | undefined {
    const now = Date.now();
    this.removeExpired(now);
    const attempt = this.clients.get(client);
    if (!attempt || attempt.count < MAX_ATTEMPTS) return undefined;
    return Math.max(1, Math.ceil((attempt.windowStartedAt + WINDOW_MS - now) / 1_000));
  }

  get size(): number {
    this.removeExpired(Date.now());
    return this.clients.size;
  }

  private removeExpired(now: number): void {
    for (const [client, attempt] of this.clients) {
      if (attempt.windowStartedAt + WINDOW_MS <= now) this.clients.delete(client);
    }
  }

  private removeOldest(): void {
    let oldestClient: string | undefined;
    let oldestAttemptAt = Number.POSITIVE_INFINITY;
    for (const [client, attempt] of this.clients) {
      if (attempt.lastAttemptAt < oldestAttemptAt) {
        oldestClient = client;
        oldestAttemptAt = attempt.lastAttemptAt;
      }
    }
    if (oldestClient) this.clients.delete(oldestClient);
  }
}
