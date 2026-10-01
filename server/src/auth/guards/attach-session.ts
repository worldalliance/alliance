import type { Request } from "express";
import { requestContext } from "src/utils/request-context";
import type { JwtPayload } from "../tokens";

export function attachSession(request: Request, session: JwtPayload): void {
  request["user"] = session;
  const ctx = requestContext.getStore();
  if (ctx) {
    ctx.userId = session.sub;
  }
}
