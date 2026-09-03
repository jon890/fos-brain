import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AdminGuard } from "./admin.guard.js";
import { authHttpException } from "./auth-errors.js";
import { readSessionCookie, SESSION_COOKIE_NAME } from "./cookie.js";
import { LoginAttemptLimiter } from "./login-attempt-limiter.service.js";
import { PasswordHashService } from "./password-hash.service.js";
import { SessionStoreService } from "./session-store.service.js";

interface LoginBody {
  password: string;
}

function validateLoginBody(body: unknown): LoginBody {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw authHttpException(400, "invalid_login");
  }
  const record = body as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    typeof record.password !== "string" ||
    record.password.length < 1 ||
    record.password.length > 256
  ) {
    throw authHttpException(400, "invalid_login");
  }
  return { password: record.password };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  path: "/",
  sameSite: "strict" as const,
  secure: true,
};

@Controller("auth")
export class AuthController {
  constructor(
    private readonly passwordHash: PasswordHashService,
    private readonly sessions: SessionStoreService,
    private readonly limiter: LoginAttemptLimiter,
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() unvalidatedBody: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ role: "admin"; expiresAt: string }> {
    const body = validateLoginBody(unvalidatedBody);
    const client = request.ip || request.socket.remoteAddress || "unknown";
    if (!this.limiter.consume(client)) throw authHttpException(429, "login_rate_limited");
    if (!(await this.passwordHash.verify(body.password))) {
      throw authHttpException(401, "invalid_credentials");
    }
    const session = this.sessions.create();
    response.cookie(SESSION_COOKIE_NAME, session.id, {
      ...COOKIE_OPTIONS,
      expires: new Date(session.expiresAt),
      maxAge: session.expiresAt - Date.now(),
    });
    return { role: "admin", expiresAt: new Date(session.expiresAt).toISOString() };
  }

  @Get("session")
  session(@Req() request: Request): { role: "public" | "admin"; expiresAt: string | null } {
    const session = this.sessions.find(readSessionCookie(request));
    if (!session) return { role: "public", expiresAt: null };
    return { role: "admin", expiresAt: new Date(session.expiresAt).toISOString() };
  }

  @Post("logout")
  @HttpCode(204)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): void {
    this.sessions.delete(readSessionCookie(request));
    response.cookie(SESSION_COOKIE_NAME, "", {
      ...COOKIE_OPTIONS,
      expires: new Date(0),
      maxAge: 0,
    });
  }

  @Get("authorize")
  @UseGuards(AdminGuard)
  @HttpCode(204)
  authorize(): void {}
}
