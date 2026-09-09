import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { z } from "zod";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const GUEST_COOKIE = "guest_token";

export enum JWTTokenType {
  access = "access",
  refresh = "refresh",
  guest = "guest",
}

const TOKEN_TYPE_IS_AUTHENTICATED: Record<JWTTokenType, boolean> = {
  [JWTTokenType.access]: true,
  [JWTTokenType.refresh]: false,
  [JWTTokenType.guest]: false,
};

const jwtPayloadSchema = z.object({
  sub: z.number(),
  email: z.string(),
  tokenType: z.enum(JWTTokenType),
  isImpersonation: z.boolean().optional(),
});

export function extractAccessToken(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(" ") ?? [];
  if (type === "Bearer" && token) {
    return token;
  }
  return request.cookies?.[ACCESS_COOKIE];
}

/**
 * The mailed and guest tokens share JWT_SECRET with access tokens, so a valid
 * signature alone does not make a session.
 */
export async function verifyAccessToken(
  jwtService: JwtService,
  token: string,
): Promise<JwtPayload> {
  const payload = jwtPayloadSchema.safeParse(
    await jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET }),
  );
  if (
    !payload.success ||
    !TOKEN_TYPE_IS_AUTHENTICATED[payload.data.tokenType]
  ) {
    throw new UnauthorizedException();
  }
  return payload.data;
}

export function accessTokenPayload({
  user,
  isImpersonation,
}: {
  user: { id: number; email: string };
  isImpersonation?: boolean;
}): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    tokenType: JWTTokenType.access,
    ...(isImpersonation && { isImpersonation: true }),
  };
}

export async function sessionFromRequest(
  jwtService: JwtService,
  request: Request,
): Promise<JwtPayload> {
  const token = extractAccessToken(request);
  if (!token) {
    throw new UnauthorizedException();
  }
  return verifyAccessToken(jwtService, token);
}

export interface JwtRequest extends Request {
  user: JwtPayload;
}
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export interface GuestJwtPayload {
  sub: string;
  tokenType: JWTTokenType.guest;
}
