import type { RawBodyRequest } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express, { type Request, type Response } from "express";

/** Routes whose handler verifies an HMAC over the bytes as sent. Each one costs a
 * second copy of the body, so keep the list short. */
const SIGNED_WEBHOOK_ROUTES = ["/payments/webhook"];

function keepRawBody(
  req: RawBodyRequest<Request>,
  _res: Response,
  buf: Buffer,
): void {
  req.rawBody = buf;
}

export function configureBodyParsers(app: NestExpressApplication): void {
  app.use(
    SIGNED_WEBHOOK_ROUTES,
    express.json({ limit: "50mb", verify: keepRawBody }),
  );
  app.useBodyParser("json", { limit: "50mb" });
  app.useBodyParser("urlencoded", { limit: "50mb", extended: true });
}
