import fs from "node:fs/promises";
import { HttpException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PrivateContentService {
  constructor(private readonly config: ConfigService) {}

  readContentIndex(): Promise<unknown> {
    return this.readConfiguredFile("BRAIN_PRIVATE_CONTENT_INDEX_FILE");
  }

  readMemoryAtlasSemantics(): Promise<unknown> {
    return this.readConfiguredFile("BRAIN_PRIVATE_MEMORY_ATLAS_SEMANTICS_FILE");
  }

  private async readConfiguredFile(key: string): Promise<unknown> {
    try {
      const file = this.config.getOrThrow<string>(key);
      const stat = await fs.stat(file);
      if (!stat.isFile()) throw new Error("not a regular file");
      return JSON.parse(await fs.readFile(file, "utf8")) as unknown;
    } catch {
      throw new HttpException({ error: { code: "private_content_unavailable" } }, 503);
    }
  }
}
