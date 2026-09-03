import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { PrivateContentService } from "./private-content.service.js";

@Controller("private")
@UseGuards(AdminGuard)
export class PrivateContentController {
  constructor(private readonly content: PrivateContentService) {}

  @Get("content-index")
  contentIndex(): Promise<unknown> {
    return this.content.readContentIndex();
  }

  @Get("memory-atlas-semantics")
  memoryAtlasSemantics(): Promise<unknown> {
    return this.content.readMemoryAtlasSemantics();
  }
}
