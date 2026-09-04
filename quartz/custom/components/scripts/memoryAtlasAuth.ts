import type { MemoryAtlasIndexEntry } from "../../emitters/memoryAtlasIndex"

export type MemoryAtlasAuthRole = "public" | "admin"

export type MemoryAtlasAuthSession = {
  role: MemoryAtlasAuthRole
  expiresAt: string | null
}

export type ProtectedMemoryAtlasData = {
  contentIndex: Record<string, MemoryAtlasIndexEntry>
  semantics: unknown
}

type AuthErrorPayload = {
  error?: {
    code?: string
  }
}

export class MemoryAtlasAuthError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAt?: Date

  constructor(status: number, code: string, retryAt?: Date) {
    super(code)
    this.name = "MemoryAtlasAuthError"
    this.status = status
    this.code = code
    this.retryAt = retryAt
  }
}

function retryAtFrom(response: Response): Date | undefined {
  const retryAfter = response.headers.get("retry-after")
  if (!retryAfter) return undefined
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) return new Date(Date.now() + seconds * 1_000)
  const date = new Date(retryAfter)
  return Number.isNaN(date.getTime()) ? undefined : date
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  })
  const payload = (await response.json().catch(() => ({}))) as T & AuthErrorPayload
  if (!response.ok) {
    throw new MemoryAtlasAuthError(
      response.status,
      payload.error?.code || "authentication_failed",
      retryAtFrom(response),
    )
  }
  return payload
}

export async function getMemoryAtlasAuthSession(): Promise<MemoryAtlasAuthSession> {
  const payload = await requestJson<Partial<MemoryAtlasAuthSession>>("/api/auth/session")
  return {
    role: payload.role === "admin" ? "admin" : "public",
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : null,
  }
}

export async function loginMemoryAtlasAdmin(password: string): Promise<MemoryAtlasAuthSession> {
  const payload = await requestJson<Partial<MemoryAtlasAuthSession>>("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  })
  if (payload.role !== "admin" || typeof payload.expiresAt !== "string") {
    throw new MemoryAtlasAuthError(502, "invalid_auth_response")
  }
  return { role: "admin", expiresAt: payload.expiresAt }
}

export async function logoutMemoryAtlasAdmin(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  })
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as AuthErrorPayload
    throw new MemoryAtlasAuthError(
      response.status,
      payload.error?.code || "logout_failed",
      retryAtFrom(response),
    )
  }
}

export async function loadProtectedMemoryAtlasData(): Promise<ProtectedMemoryAtlasData> {
  const [contentIndex, semantics] = await Promise.all([
    requestJson<Record<string, MemoryAtlasIndexEntry>>("/api/private/content-index"),
    requestJson<unknown>("/api/private/memory-atlas-semantics"),
  ])
  return { contentIndex, semantics }
}

export function isMemoryAtlasUnauthorized(error: unknown): boolean {
  return error instanceof MemoryAtlasAuthError && error.status === 401
}
