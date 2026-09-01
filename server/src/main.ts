import { devPorts, PortCaller } from "@alliance/common/dev-ports";
import { currentNodeEnv, isDeployed } from "@alliance/common/node-env";
import { ValidationPipe } from "@nestjs/common";
import { HttpAdapterHost, NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { useContainer } from "class-validator";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { PostHog, setupExpressErrorHandler } from "posthog-node";
import type { ServerOptions } from "socket.io";
import { AppModule } from "./app.module";
import { MetricsInterceptor } from "./metrics";
import { twilioSignatureEnforced } from "./mms/twilio-signature.guard";
import { injectResponseSchemas } from "./openapi-errors";
import { PosthogExceptionFilter } from "./posthog.filter";
import { configureBodyParsers } from "./utils/body-parsers";
import { socketCorsOrigins } from "./utils/cors-origins";
import { requestContext } from "./utils/request-context";
import { RouteContextGuard } from "./utils/request-context.guard";
import { VALIDATION_PIPE_OPTIONS } from "./utils/validation-pipe-options";

// Let validateNodeEnv report unknown values without treating them as deployed.
function deployedUrlVars(): string[] {
  const env = currentNodeEnv();
  if (!env.ok || !isDeployed(env.value)) return [];
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
    ...deployedUrlVars(),
  ]);

  const missing = [...requiredVars].filter((v) => !process.env[v]);

  if (missing.length > 0) {
    console.error(
      `ERR: Missing required environment variables: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  validateNodeEnv();
}

function validateNodeEnv() {
  const env = currentNodeEnv();
  if (env.ok) return;

  const msg = `:warning: Server starting with ${env.error.message}. Outbound notifs may misfire.`;
  console.error(msg);

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  void fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: msg }),
  }).catch((err) => {
    console.error("Failed to post NODE_ENV warning to Slack:", err);
  });
}

class SocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: socketCorsOrigins({
          nodeEnv: process.env.NODE_ENV,
          appUrl: process.env.APP_URL,
          altAppUrl: process.env.ALT_APP_URL,
          adminUrl: process.env.ADMIN_URL,
          altAdminUrl: process.env.ALT_ADMIN_URL,
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
  let client: PostHog | null = null;

  if (process.env.NODE_ENV === "production") {
    client = new PostHog(process.env.POSTHOG_KEY!, {
      host: "https://us.i.posthog.com",
    });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  configureBodyParsers(app);
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.useGlobalGuards(new RouteContextGuard());
  app.useGlobalInterceptors(new MetricsInterceptor());
  app.use((req, _res, next) => {
    requestContext.run(
      {
        requestId: randomUUID(),
        method: req.method,
        url: req.originalUrl,
      },
      () => next(),
    );
  });
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    exposedHeaders: ["X-Guest-Token"],
  });
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  app.set("trust proxy", "loopback");

  if (process.env.NODE_ENV !== "production") {
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

  if (client) {
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new PosthogExceptionFilter(client, httpAdapter));
    setupExpressErrorHandler(client, app);
  }

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
