import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AskQuestionDto } from "./ask-question.dto.js";
import { BrainAskService } from "./brain-ask.service.js";
import type { BrainAskSuccess } from "./contracts.js";

@Controller("brain")
export class BrainAskController {
  constructor(private readonly brainAsk: BrainAskService) {}

  @Post("ask")
  @HttpCode(200)
  ask(@Body() body: AskQuestionDto): Promise<BrainAskSuccess> {
    return this.brainAsk.ask(body.question);
  }
}
