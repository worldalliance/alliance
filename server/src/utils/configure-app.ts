import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { createRequestContext, requestContext } from "./request-context";
import { VALIDATION_PIPE_OPTIONS } from "./validation-pipe-options";

/** Setup shared with the e2e test app. Setup left in `bootstrap()` never runs
 * under the e2e tests. */
export function configureApp(app: NestExpressApplication): void {
  app.use((req, _res, next) => {
    requestContext.run(createRequestContext(req), () => next());
  });
  // Bun's server.close() keeps a keep-alive connection open for about 6 s after
  // a response that finishes once close has started, past pm2's 1.6 s kill.
  app.use((_req, res, next) => {
    res.on("finish", () => {
      const server = app.getHttpServer();
      if (!server.listening) server.closeIdleConnections();
    });
    next();
  });
  app.useBodyParser("json", { limit: "50mb" });
  app.useBodyParser("urlencoded", { limit: "50mb", extended: true });
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.use(cookieParser());
  // iOS revalidates an ETag on its own and hands the app the cached body under
  // the 304's Content-Length: 0, which the generated client reads as no body.
  app.set("etag", false);
}
