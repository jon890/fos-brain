import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { BrainAskModule } from "./brain-ask/brain-ask.module.js";
import { AppConfigModule } from "./config/app-config.module.js";
import { HealthController } from "./health.controller.js";
import { PrivateContentModule } from "./private-content/private-content.module.js";

@Module({
  imports: [AppConfigModule.register(), AuthModule, BrainAskModule, PrivateContentModule],
  controllers: [HealthController],
})
export class AppModule {}
