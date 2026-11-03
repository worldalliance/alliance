// First, so an invalid environment is reported whole before any module reads it.
import "./config/validate-env";

import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import { GUEST_HEADER } from "@alliance/common/guest";
import { NodeEnv } from "@alliance/common/node-env";
import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { useContainer } from "class-validator";
import type { ServerOptions } from "socket.io";
import { AppModule } from "./app.module";
import { env } from "./config/env";
import { MetricsInterceptor } from "./metrics";
import { injectResponseSchemas } from "./openapi-errors";
import { capturePosthogExceptions } from "./posthog.filter";
import { posthogClientIfEnabled } from "./posthog/posthog-client";
import { configureApp } from "./utils/configure-app";
import { socketCorsOrigins } from "./utils/cors-origins";
import { RouteContextGuard } from "./utils/request-context.guard";

class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: socketCorsOrigins({
          nodeEnv: env("NODE_ENV"),
          appUrl: env("APP_URL"),
          altAppUrl: env("ALT_APP_URL"),
          adminUrl: env("ADMIN_URL"),
          altAdminUrl: env("ALT_ADMIN_URL"),
        }),
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
  }
}

async function bootstrap() {
  const port = devPorts(PortCaller.Server).server;
  const client = posthogClientIfEnabled();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  configureApp(app);
  app.useGlobalGuards(new RouteContextGuard());
  app.useGlobalInterceptors(new MetricsInterceptor());
  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    exposedHeaders: [
      GUEST_HEADER,
      NOTIFS_LOADED_AT_HEADER,
      "Content-Disposition",
    ],
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.set("trust proxy", "loopback");

  if (env("NODE_ENV") !== NodeEnv.Production) {
    const config = new DocumentBuilder()
      .setTitle("Alliance API")
      .setVersion("1.0")
      .addTag("alliance")
      .addBearerAuth()
      .build();

    const documentFactory = () =>
      injectResponseSchemas(
        SwaggerModule.createDocument(app, config, {
          operationIdFactory: (controllerKey: string, methodKey: string) =>
            controllerKey.replace("Controller", "") + "_" + methodKey,
        }),
      );

    SwaggerModule.setup("openapi", app, documentFactory, {
      yamlDocumentUrl: "/openapi.yaml",
    });
  }

  if (client) capturePosthogExceptions(app, client);

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
