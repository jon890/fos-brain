import type { NextFunction, Request, Response } from "express";
import { InvalidQuestionError } from "./brain-ask.errors.js";

const MAX_BODY_BYTES = 4 * 1024;

export function createBrainAskBodyParser(timeoutMs: number) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.method !== "POST" || request.path !== "/api/brain/ask") {
      next();
      return;
    }
    response.setHeader("cache-control", "no-store");
    const contentType = request.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
    ) {
      request.resume();
      next(new InvalidQuestionError());
      return;
    }
    const declaredLength = Number.parseInt(request.headers["content-length"] ?? "0", 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      request.resume();
      next(new InvalidQuestionError());
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
    };
    const fail = () => {
      if (settled) return;
      cleanup();
      request.resume();
      next(new InvalidQuestionError());
    };
    const onData = (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail();
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (settled) return;
      cleanup();
      try {
        request.body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
        next();
      } catch {
        next(new InvalidQuestionError());
      }
    };
    const onError = () => fail();
    const timer = setTimeout(fail, timeoutMs);
    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
  };
}
