import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  imports: [AppConfigModule.register()],
  controllers: [HealthController],
})
export class AppModule {}
