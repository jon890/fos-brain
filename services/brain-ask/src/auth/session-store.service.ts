import { createHash, randomBytes } from "node:crypto";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_SESSIONS = 8;

export interface AdminSession {
  role: "admin";
  createdAt: number;
  expiresAt: number;
}

export interface CreatedSession extends AdminSession {
  id: string;
}

function digest(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

@Injectable()
export class SessionStoreService implements OnApplicationShutdown {
  private readonly sessions = new Map<string, AdminSession>();

  create(): CreatedSession {
    const now = Date.now();
    this.removeExpired(now);
    const id = randomBytes(32).toString("base64url");
    const session: AdminSession = {
      role: "admin",
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    this.sessions.set(digest(id), session);
    while (this.sessions.size > MAX_SESSIONS) this.removeOldest();
    return { id, ...session };
  }

  find(id: string | undefined): AdminSession | undefined {
    const now = Date.now();
    this.removeExpired(now);
    if (!id) return undefined;
    return this.sessions.get(digest(id));
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(digest(id));
  }

  get size(): number {
    this.removeExpired(Date.now());
    return this.sessions.size;
  }

  onApplicationShutdown(): void {
    this.sessions.clear();
  }

  private removeExpired(now: number): void {
    for (const [idHash, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(idHash);
    }
  }

  private removeOldest(): void {
    let oldestId: string | undefined;
    let oldestCreatedAt = Number.POSITIVE_INFINITY;
    for (const [idHash, session] of this.sessions) {
      if (session.createdAt < oldestCreatedAt) {
        oldestId = idHash;
        oldestCreatedAt = session.createdAt;
      }
    }
    if (oldestId) this.sessions.delete(oldestId);
  }
}
