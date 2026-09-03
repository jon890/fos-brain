import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { AskQuestionDto } from "./ask-question.dto.js";
import { BrainAskService } from "./brain-ask.service.js";
import type { BrainAskSuccess } from "./contracts.js";

@Controller("brain")
@UseGuards(AdminGuard)
export class BrainAskController {
  constructor(private readonly brainAsk: BrainAskService) {}

  @Post("ask")
  @HttpCode(200)
  ask(@Body() body: AskQuestionDto): Promise<BrainAskSuccess> {
    return this.brainAsk.ask(body.question);
  }
}
