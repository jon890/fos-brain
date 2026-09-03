import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TempBrain {
  root: string;
  publicWiki: string;
  privateWiki: string;
  keyFile: string;
}

export async function createTempBrain(): Promise<TempBrain> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "brain-ask-"));
  const publicWiki = path.join(root, "public", "wiki");
  const privateWiki = path.join(root, "private", "wiki");
  const keyFile = path.join(root, "model-key");
  await fs.mkdir(path.join(publicWiki, "concepts"), { recursive: true });
  await fs.mkdir(path.join(privateWiki, "entities"), { recursive: true });
  await fs.writeFile(path.join(publicWiki, "concepts", "agent.md"), "# Agent\npublic body\n");
  await fs.writeFile(path.join(privateWiki, "entities", "style.md"), "# Style\nprivate body\n");
  await fs.writeFile(keyFile, "fixture-key\n", { mode: 0o600 });
  return { root, publicWiki, privateWiki, keyFile };
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
