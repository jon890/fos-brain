import type { Request } from "express";

export const SESSION_COOKIE_NAME = "__Host-brain_session";

export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  let value: string | undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    if (value !== undefined) return undefined;
    const candidate = part.slice(separator + 1).trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(candidate)) return undefined;
    value = candidate;
  }
  return value;
}
