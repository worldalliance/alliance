import { UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const GUEST_COOKIE = "guest_token";

export enum JWTTokenType {
  access = "access",
  refresh = "refresh",
  guest = "guest",
}

export function extractAccessToken(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(" ") ?? [];
  if (type === "Bearer" && token) {
    return token;
  }
  return request.cookies?.[ACCESS_COOKIE];
}

export async function verifyAccessToken(
  jwtService: JwtService,
  token: string,
): Promise<JwtPayload> {
  return jwtService.verifyAsync<JwtPayload>(token, {
    secret: process.env.JWT_SECRET,
  });
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
export interface JwtPayload {
  sub: number;
  email: string;
  tokenType: JWTTokenType;
  isImpersonation?: boolean;
}

export interface GuestJwtPayload {
  sub: string;
  tokenType: JWTTokenType.guest;
}
