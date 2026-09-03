import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { authHttpException } from "./auth-errors.js";

export function assertAllowedOrigin(request: Request, allowedOrigin: string): void {
  if (request.method !== "POST") return;
  const header = request.headers.origin;
  if (typeof header !== "string") throw authHttpException(403, "origin_rejected");
  let origin: string;
  try {
    origin = new URL(header).origin;
  } catch {
    throw authHttpException(403, "origin_rejected");
  }
  if (origin !== allowedOrigin) throw authHttpException(403, "origin_rejected");
}

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    assertAllowedOrigin(request, this.config.getOrThrow<string>("BRAIN_ORIGIN"));
    return true;
  }
}
