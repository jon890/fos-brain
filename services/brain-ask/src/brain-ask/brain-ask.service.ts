import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { brainAskHttpException, BrainAskError } from "./brain-ask.errors.js";
import type {
  BrainAskErrorCode,
  BrainAskSuccess,
  ModelClient,
  QmdClient,
} from "./contracts.js";
import { normalizeQmdResults, readLimitedFile, selectEvidence } from "./evidence.js";
import { MODEL_CLIENT, QMD_CLIENT } from "./tokens.js";

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

@Injectable()
export class BrainAskService implements OnApplicationShutdown {
  private inFlightRequestId?: string;
  private readonly activeControllers = new Set<AbortController>();

  constructor(
    private readonly config: ConfigService,
    @Inject(QMD_CLIENT) private readonly qmd: QmdClient,
    @Inject(MODEL_CLIENT) private readonly model: ModelClient,
  ) {}

  async ask(question: string): Promise<BrainAskSuccess> {
    const id = requestId();
    const started = Date.now();
    let status = 200;
    let qmdMs = 0;
    let modelMs = 0;
    let evidenceCount = 0;
    let lockAcquired = false;

    try {
      if (this.inFlightRequestId) {
        status = 429;
        throw brainAskHttpException(id, "busy");
      }
      this.inFlightRequestId = id;
      lockAcquired = true;

      const qmdStarted = Date.now();
      let qmdPayload;
      try {
        qmdPayload = await this.withTimeout(
          this.config.getOrThrow<number>("BRAIN_QMD_TIMEOUT_MS"),
          (signal) => this.qmd.search({ question, signal }),
        );
      } catch (error) {
        throw new BrainAskError(
          "retrieval_unavailable",
          isAbortError(error) ? "qmd timeout" : "qmd unavailable",
        );
      } finally {
        qmdMs = Date.now() - qmdStarted;
      }

      const normalized = normalizeQmdResults(qmdPayload, {
        publicWikiRoot: this.config.getOrThrow<string>("BRAIN_PUBLIC_WIKI_ROOT"),
        privateWikiRoot: this.config.getOrThrow<string>("BRAIN_PRIVATE_WIKI_ROOT"),
      });
      const { context, sources } = await selectEvidence(normalized, readLimitedFile);
      evidenceCount = sources.length;
      if (sources.length === 0) return { requestId: id, answer: "", sources: [] };

      const modelStarted = Date.now();
      let answer: string;
      try {
        answer = await this.withTimeout(
          this.config.getOrThrow<number>("MODEL_TIMEOUT_MS"),
          (signal) => this.model.answer({ question, context, signal }),
        );
      } catch (error) {
        if (isAbortError(error)) throw new BrainAskError("model_timeout");
        throw error;
      } finally {
        modelMs = Date.now() - modelStarted;
      }
      return { requestId: id, answer, sources };
    } catch (error) {
      if (error instanceof BrainAskError) {
        const code = error.code;
        status = this.statusFor(code);
        throw brainAskHttpException(id, code);
      }
      if (error instanceof Error && "getStatus" in error) {
        throw error;
      }
      status = 502;
      throw brainAskHttpException(id, "model_unavailable");
    } finally {
      if (lockAcquired && this.inFlightRequestId === id) this.inFlightRequestId = undefined;
      process.stdout.write(
        `${JSON.stringify({
          requestId: id,
          status,
          qmdMs,
          modelMs,
          evidenceCount,
          totalMs: Date.now() - started,
        })}\n`,
      );
    }
  }

  onApplicationShutdown(): void {
    for (const controller of this.activeControllers) controller.abort();
    this.activeControllers.clear();
  }

  private async withTimeout<T>(
    timeoutMs: number,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timer);
      this.activeControllers.delete(controller);
    }
  }

  private statusFor(code: BrainAskErrorCode): number {
    if (code === "invalid_question") return 400;
    if (code === "busy") return 429;
    if (code === "model_timeout") return 504;
    return 502;
  }
}
