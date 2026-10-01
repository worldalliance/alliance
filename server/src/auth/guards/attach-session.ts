import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { requestContext } from "src/utils/request-context";
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
  request: Request;
  token: string;
}): Promise<void> {
  try {
    attachSession(
      params.request,
      await verifyAccessToken(params.jwtService, params.token),
    );
  } catch {
    throw new UnauthorizedException();
  }
}
