import { Module } from "@nestjs/common";
import { PrivateContentController } from "./private-content.controller.js";
import { PrivateContentService } from "./private-content.service.js";

@Module({
  controllers: [PrivateContentController],
  providers: [PrivateContentService],
})
export class PrivateContentModule {}
