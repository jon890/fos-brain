import { HttpException } from "@nestjs/common";

export type AuthErrorCode =
  | "authentication_required"
  | "invalid_credentials"
  | "invalid_login"
  | "login_rate_limited"
  | "origin_rejected";

export function authHttpException(status: number, code: AuthErrorCode): HttpException {
  return new HttpException({ error: { code } }, status);
}
