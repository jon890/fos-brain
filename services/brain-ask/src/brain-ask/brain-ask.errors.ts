import { HttpException } from "@nestjs/common";
import type { BrainAskErrorCode } from "./contracts.js";

const ERROR_MESSAGES: Record<BrainAskErrorCode, string> = {
  invalid_question: "Question must be a JSON string from 1 to 500 characters.",
  busy: "Another question is already being processed.",
  retrieval_unavailable: "Evidence retrieval is unavailable.",
  model_unavailable: "Model API is unavailable.",
  model_timeout: "Model API timed out.",
};

const ERROR_STATUS: Record<BrainAskErrorCode, number> = {
  invalid_question: 400,
  busy: 429,
  retrieval_unavailable: 502,
  model_unavailable: 502,
  model_timeout: 504,
};

export class BrainAskError extends Error {
  constructor(readonly code: BrainAskErrorCode, message: string = code) {
    super(message);
  }
}

export class InvalidQuestionError extends BrainAskError {
  constructor() {
    super("invalid_question");
  }
}

export function errorDetails(code: BrainAskErrorCode): {
  code: BrainAskErrorCode;
  message: string;
  retryable: boolean;
} {
  return {
    code,
    message: ERROR_MESSAGES[code],
    retryable: code !== "invalid_question",
  };
}

export function brainAskHttpException(requestId: string, code: BrainAskErrorCode): HttpException {
  return new HttpException(
    { requestId, error: errorDetails(code) },
    ERROR_STATUS[code],
  );
}
