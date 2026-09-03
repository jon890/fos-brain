import { Module } from "@nestjs/common";
import { BrainAskController } from "./brain-ask.controller.js";
import { BrainAskService } from "./brain-ask.service.js";
import { HttpModelClient } from "./model.client.js";
import { HttpQmdClient } from "./qmd.client.js";
import { FETCH_IMPL, MODEL_CLIENT, QMD_CLIENT } from "./tokens.js";

@Module({
  controllers: [BrainAskController],
  providers: [
    BrainAskService,
    { provide: FETCH_IMPL, useValue: globalThis.fetch.bind(globalThis) },
    { provide: QMD_CLIENT, useClass: HttpQmdClient },
    { provide: MODEL_CLIENT, useClass: HttpModelClient },
  ],
  exports: [BrainAskService],
})
export class BrainAskModule {}
