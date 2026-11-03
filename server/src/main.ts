import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import { GUEST_HEADER } from "@alliance/common/guest";
import { isDeployed, NodeEnv } from "@alliance/common/node-env";
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
import { twilioSignatureEnforced } from "./mms/twilio-signature.guard";
import { injectResponseSchemas } from "./openapi-errors";
import { capturePosthogExceptions } from "./posthog.filter";
import { posthogClientIfEnabled } from "./posthog/posthog-client";
import { configureApp } from "./utils/configure-app";
import { socketCorsOrigins } from "./utils/cors-origins";
import { deliverySends } from "./utils/notif-delivery";
import { RouteContextGuard } from "./utils/request-context.guard";
import { publicMailDailyCap } from "./waitlist/waitlist-mail.service";

function deployedUrlVars(): string[] {
  if (!isDeployed(env("NODE_ENV"))) return [];
  return ["APP_URL", "ALT_APP_URL", "ADMIN_URL", "ALT_ADMIN_URL"];
}

function validateEnv() {
  const requiredVars = new Set([
    "DB_HOST",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    ...(twilioSignatureEnforced() ? ["TWILIO_AUTH_TOKEN", "APP_URL"] : []),
    ...(deliverySends() ? ["MAIL_FROM"] : []),
    ...deployedUrlVars(),
  ]);

  const missing = [...requiredVars].filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(
      `ERR: Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  // Parses the waitlist mail cap now, so a malformed one fails boot rather
  // than a request.
  publicMailDailyCap();
}

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
  validateEnv();

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
