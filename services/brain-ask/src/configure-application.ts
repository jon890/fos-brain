import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { createAuthBodyParser } from "./auth/auth-body-parser.js";
import { assertAllowedOrigin } from "./auth/origin.guard.js";
import { createBrainAskBodyParser } from "./brain-ask/brain-ask-body-parser.js";
import { HttpExceptionFilter } from "./http-exception.filter.js";

export function configureApplication(app: INestApplication): void {
  app.setGlobalPrefix("api");
  const config = app.get(ConfigService);
  const express = app.getHttpAdapter().getInstance() as {
    set(name: string, value: unknown): void;
  };
  express.set("trust proxy", config.getOrThrow<number>("BRAIN_TRUST_PROXY_HOPS"));
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (
      request.path.startsWith("/api/auth/") ||
      request.path.startsWith("/api/private/") ||
      request.path.startsWith("/api/brain/")
    ) {
      response.setHeader("cache-control", "private, no-store");
    }
    next();
  });
  app.use((request: Request, _response: Response, next: NextFunction) => {
    try {
      assertAllowedOrigin(request, config.getOrThrow<string>("BRAIN_ORIGIN"));
      next();
    } catch (error) {
      next(error);
    }
  });
  app.use(createAuthBodyParser(config.getOrThrow<number>("BRAIN_ASK_BODY_TIMEOUT_MS")));
  app.use(createBrainAskBodyParser(config.getOrThrow<number>("BRAIN_ASK_BODY_TIMEOUT_MS")));
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
