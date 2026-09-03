import fs from "node:fs/promises";
import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it } from "vitest";
import { PasswordHashService } from "../../src/auth/password-hash.service.js";
import {
  createTempBrain,
  TEST_ADMIN_PASSWORD,
  type TempBrain,
} from "../test-helpers.js";

describe("PasswordHashService", () => {
  let brain: TempBrain | undefined;

  afterEach(async () => {
    if (brain) await fs.rm(brain.root, { recursive: true, force: true });
    brain = undefined;
  });

  it("verifies the configured scrypt hash without exposing mismatch details", async () => {
    brain = await createTempBrain();
    const service = new PasswordHashService(
      new ConfigService({ BRAIN_ADMIN_PASSWORD_HASH_FILE: brain.passwordHashFile }),
    );
    await service.onModuleInit();
    await expect(service.verify(TEST_ADMIN_PASSWORD)).resolves.toBe(true);
    await expect(service.verify("wrong password")).resolves.toBe(false);
  });

  it("fails startup for malformed hashes, short salt and wrong file mode", async () => {
    brain = await createTempBrain();
    const service = () =>
      new PasswordHashService(
        new ConfigService({ BRAIN_ADMIN_PASSWORD_HASH_FILE: brain!.passwordHashFile }),
      );

    await fs.writeFile(brain.passwordHashFile, "not-a-scrypt-hash", { mode: 0o600 });
    await expect(service().onModuleInit()).rejects.toThrow(/Invalid administrator password hash/);

    await fs.writeFile(
      brain.passwordHashFile,
      `scrypt$131072$8$1$${Buffer.alloc(15).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`,
    );
    await expect(service().onModuleInit()).rejects.toThrow(/password hash length/);

    await fs.chmod(brain.passwordHashFile, 0o644);
    await expect(service().onModuleInit()).rejects.toThrow(/mode 600 regular file/);
  });
});
