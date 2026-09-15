import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import { VALIDATION_PIPE_OPTIONS } from "./validation-pipe-options";

/** Setup shared with the e2e test app. Setup left in `bootstrap()` never runs
 * under the e2e tests. */
export function configureApp(app: NestExpressApplication): void {
  app.useBodyParser("json", { limit: "50mb" });
  app.useBodyParser("urlencoded", { limit: "50mb", extended: true });
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.use(cookieParser());
  // iOS revalidates an ETag on its own and hands the app the cached body under
  // the 304's Content-Length: 0, which the generated client reads as no body.
  app.set("etag", false);
}
