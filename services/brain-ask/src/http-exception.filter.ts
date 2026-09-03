import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import type { Response } from "express";
import { errorDetails, InvalidQuestionError } from "./brain-ask/brain-ask.errors.js";

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof InvalidQuestionError || exception instanceof BadRequestException) {
      const id = requestId();
      response.status(400).json({ requestId: id, error: errorDetails("invalid_question") });
      this.logInvalid(id);
      return;
    }
    if (exception instanceof NotFoundException) {
      response.status(404).json({ error: { code: "not_found" } });
      return;
    }
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    const id = requestId();
    response.status(502).json({ requestId: id, error: errorDetails("model_unavailable") });
    process.stdout.write(
      `${JSON.stringify({
        requestId: id,
        status: 502,
        qmdMs: 0,
        modelMs: 0,
        evidenceCount: 0,
        totalMs: 0,
      })}\n`,
    );
  }

  private logInvalid(id: string): void {
    process.stdout.write(
      `${JSON.stringify({
        requestId: id,
        status: 400,
        qmdMs: 0,
        modelMs: 0,
        evidenceCount: 0,
        totalMs: 0,
      })}\n`,
    );
  }
}
