import fs from "node:fs/promises";
import { scrypt, timingSafeEqual } from "node:crypto";
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const SCRYPT_N = 131_072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DERIVED_KEY_BYTES = 64;
const MAX_MEMORY_BYTES = 256 * 1024 * 1024;

function decodeBase64Url(value: string, field: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`Invalid administrator password hash ${field}`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new Error(`Invalid administrator password hash ${field}`);
  }
  return decoded;
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      DERIVED_KEY_BYTES,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY_BYTES },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

@Injectable()
export class PasswordHashService implements OnModuleInit {
  private salt?: Buffer;
  private expectedKey?: Buffer;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const file = this.config.getOrThrow<string>("BRAIN_ADMIN_PASSWORD_HASH_FILE");
    const handle = await fs.open(file, "r");
    let contents: string;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) {
        throw new Error("Administrator password hash file must be a mode 600 regular file");
      }
      contents = await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
    const encoded = contents.endsWith("\n") ? contents.slice(0, -1) : contents;
    if (!encoded || encoded.includes("\n") || encoded.includes("\r")) {
      throw new Error("Administrator password hash file must contain exactly one line");
    }
    const parts = encoded.split("$");
    if (
      parts.length !== 6 ||
      parts[0] !== "scrypt" ||
      parts[1] !== String(SCRYPT_N) ||
      parts[2] !== String(SCRYPT_R) ||
      parts[3] !== String(SCRYPT_P)
    ) {
      throw new Error("Invalid administrator password hash format");
    }
    const salt = decodeBase64Url(parts[4]!, "salt");
    const expectedKey = decodeBase64Url(parts[5]!, "derived key");
    if (salt.length < 16 || expectedKey.length !== DERIVED_KEY_BYTES) {
      throw new Error("Invalid administrator password hash length");
    }
    this.salt = salt;
    this.expectedKey = expectedKey;
  }

  async verify(password: string): Promise<boolean> {
    if (!this.salt || !this.expectedKey) throw new Error("Administrator password hash is unavailable");
    const actualKey = await deriveKey(password, this.salt);
    return timingSafeEqual(actualKey, this.expectedKey);
  }
}
