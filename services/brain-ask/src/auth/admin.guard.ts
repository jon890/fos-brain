import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { authHttpException } from "./auth-errors.js";
import { readSessionCookie } from "./cookie.js";
import { SessionStoreService } from "./session-store.service.js";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionStoreService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!this.sessions.find(readSessionCookie(request))) {
      throw authHttpException(401, "authentication_required");
    }
    return true;
  }
}
