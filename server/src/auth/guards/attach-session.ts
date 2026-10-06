import { R } from "@alliance/common/result";
import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { requestContext } from "src/utils/request-context";
import type { SessionService } from "../session.service";
import { type JwtPayload, verifyAccessToken } from "../tokens";

export function attachSession(request: Request, session: JwtPayload): void {
  request["user"] = session;
  const ctx = requestContext.getStore();
  if (ctx) {
    ctx.userId = session.sub;
  }
}

export async function attachAccessSession(params: {
  jwtService: JwtService;
  sessionService: SessionService;
  request: Request;
  token: string;
}): Promise<void> {
  const session = await R.fromPromise(
    verifyAccessToken(params.jwtService, params.token),
  );
  if (!session.ok) throw new UnauthorizedException();
  await params.sessionService.assertCurrent(session.value);
  attachSession(params.request, session.value);
}
