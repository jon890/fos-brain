import { randomBytes, scrypt } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempBrain {
  root: string;
  publicWiki: string;
  privateWiki: string;
  keyFile: string;
  passwordHashFile: string;
  privateContentIndexFile: string;
  privateSemanticsFile: string;
}

export const TEST_BRAIN_ORIGIN = "https://brain.example.test";
export const TEST_ADMIN_PASSWORD = "fixture administrator password";

function deriveFixtureKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131_072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function createTempBrain(): Promise<TempBrain> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "brain-ask-"));
  const publicWiki = path.join(root, "public", "wiki");
  const privateWiki = path.join(root, "private", "wiki");
  const keyFile = path.join(root, "model-key");
  const passwordHashFile = path.join(root, "administrator-password-hash");
  const privateContentIndexFile = path.join(root, "content-index.json");
  const privateSemanticsFile = path.join(root, "memory-atlas-semantics.json");
  await fs.mkdir(path.join(publicWiki, "concepts"), { recursive: true });
  await fs.mkdir(path.join(privateWiki, "entities"), { recursive: true });
  await fs.writeFile(path.join(publicWiki, "concepts", "agent.md"), "# Agent\npublic body\n");
  await fs.writeFile(path.join(privateWiki, "entities", "style.md"), "# Style\nprivate body\n");
  await fs.writeFile(keyFile, "fixture-key\n", { mode: 0o600 });
  const salt = randomBytes(16);
  const key = await deriveFixtureKey(TEST_ADMIN_PASSWORD, salt);
  await fs.writeFile(
    passwordHashFile,
    `scrypt$131072$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`,
    { mode: 0o600 },
  );
  await fs.writeFile(privateContentIndexFile, JSON.stringify({ nodes: [{ slug: "private" }] }));
  await fs.writeFile(privateSemanticsFile, JSON.stringify({ schemaVersion: 1, edges: [] }));
  return {
    root,
    publicWiki,
    privateWiki,
    keyFile,
    passwordHashFile,
    privateContentIndexFile,
    privateSemanticsFile,
  };
}

export function setTestEnvironment(brain: TempBrain, overrides: NodeJS.ProcessEnv = {}): void {
  Object.assign(process.env, {
    NODE_ENV: "test",
    PORT: "0",
    BRAIN_QMD_URL: "http://127.0.0.1:8181",
    MODEL_API_BASE_URL: "http://127.0.0.1:8182",
    MODEL_API_KEY_FILE: brain.keyFile,
    BRAIN_PUBLIC_WIKI_ROOT: brain.publicWiki,
    BRAIN_PRIVATE_WIKI_ROOT: brain.privateWiki,
    BRAIN_ADMIN_PASSWORD_HASH_FILE: brain.passwordHashFile,
    BRAIN_PRIVATE_CONTENT_INDEX_FILE: brain.privateContentIndexFile,
    BRAIN_PRIVATE_MEMORY_ATLAS_SEMANTICS_FILE: brain.privateSemanticsFile,
    BRAIN_ORIGIN: TEST_BRAIN_ORIGIN,
    BRAIN_TRUST_PROXY_HOPS: "0",
    BRAIN_QMD_TIMEOUT_MS: "50",
    MODEL_TIMEOUT_MS: "50",
    BRAIN_ASK_BODY_TIMEOUT_MS: "40",
    MODEL_MAX_OUTPUT_TOKENS: "12",
    MODEL_MAX_RESPONSE_BYTES: "1536",
    BRAIN_ASK_MAX_ANSWER_CHARS: "20",
    MODEL_NAME: "brain",
    ...overrides,
  });
}
