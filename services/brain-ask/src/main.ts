import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApplication } from "./configure-application.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApplication(app, { enableBrainAskRoute: false });
  app.enableShutdownHooks();
  const port = app.get(ConfigService).getOrThrow<number>("PORT");
  await app.listen(port, "0.0.0.0");
}

await bootstrap();
