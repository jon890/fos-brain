import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminGuard } from "./admin.guard.js";
import { AuthController } from "./auth.controller.js";
import { LoginAttemptLimiter } from "./login-attempt-limiter.service.js";
import { OriginGuard } from "./origin.guard.js";
import { PasswordHashService } from "./password-hash.service.js";
import { SessionStoreService } from "./session-store.service.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    PasswordHashService,
    SessionStoreService,
    LoginAttemptLimiter,
    AdminGuard,
    OriginGuard,
    { provide: APP_GUARD, useExisting: OriginGuard },
  ],
  exports: [AdminGuard, SessionStoreService],
})
export class AuthModule {}
