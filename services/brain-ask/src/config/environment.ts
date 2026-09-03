import { plainToInstance, Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from "class-validator";

export class EnvironmentVariables {
  @IsIn(["development", "production", "test"])
  NODE_ENV = "development";

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65_535)
  PORT = 8787;

  @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_tld: false })
  BRAIN_QMD_URL!: string;

  @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_tld: false })
  MODEL_API_BASE_URL!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  MODEL_API_KEY_FILE!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  BRAIN_PUBLIC_WIKI_ROOT!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  BRAIN_PRIVATE_WIKI_ROOT!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60_000)
  BRAIN_QMD_TIMEOUT_MS = 10_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300_000)
  MODEL_TIMEOUT_MS = 90_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60_000)
  BRAIN_ASK_BODY_TIMEOUT_MS = 5_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  MODEL_MAX_OUTPUT_TOKENS = 700;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_048_576)
  MODEL_MAX_RESPONSE_BYTES = 64 * 1024;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  BRAIN_ASK_MAX_ANSWER_CHARS = 4_000;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  MODEL_NAME = "brain";
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  for (const key of [
    "PORT",
    "BRAIN_QMD_TIMEOUT_MS",
    "MODEL_TIMEOUT_MS",
    "BRAIN_ASK_BODY_TIMEOUT_MS",
    "MODEL_MAX_OUTPUT_TOKENS",
    "MODEL_MAX_RESPONSE_BYTES",
    "BRAIN_ASK_MAX_ANSWER_CHARS",
  ]) {
    const value = config[key];
    if (
      value !== undefined &&
      !(
        (typeof value === "number" && Number.isFinite(value)) ||
        (typeof value === "string" && /^\d+$/.test(value.trim()))
      )
    ) {
      throw new Error(`Invalid brain-ask configuration: ${key} must be an integer`);
    }
  }
  const candidate = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });
  const errors = validateSync(candidate, {
    skipMissingProperties: false,
    whitelist: true,
  });
  if (errors.length > 0) {
    throw new Error(`Invalid brain-ask configuration: ${errors.join("; ")}`);
  }
  return candidate;
}
