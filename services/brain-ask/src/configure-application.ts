import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { createBrainAskBodyParser } from "./brain-ask/brain-ask-body-parser.js";
import { HttpExceptionFilter } from "./http-exception.filter.js";

export function configureApplication(
  app: INestApplication,
  options: { enableBrainAskRoute: boolean },
): void {
  app.setGlobalPrefix("api");
  app.use(helmet());
  if (options.enableBrainAskRoute) {
    const config = app.get(ConfigService);
    app.use(
      createBrainAskBodyParser(config.getOrThrow<number>("BRAIN_ASK_BODY_TIMEOUT_MS")),
    );
  }
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
