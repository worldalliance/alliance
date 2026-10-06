import { GUEST_HEADER } from "@alliance/common/guest";
import { R, type Result } from "@alliance/common/result";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { z } from "zod";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const GUEST_COOKIE = "guest_token";
export const OAUTH_STATE_COOKIE = "oauth_state";
export const APPLE_USER_COOKIE = "oauth_apple_user";

export enum JWTTokenType {
  access = "access",
  refresh = "refresh",
  guest = "guest",
  passwordReset = "password_reset",
  verifyEmail = "verify_email",
  oauthState = "oauth_state",
  oauthHandoff = "oauth_handoff",
  oauthLinkHandoff = "oauth_link_handoff",
}

const TOKEN_TYPE_IS_AUTHENTICATED: Record<JWTTokenType, boolean> = {
  [JWTTokenType.access]: true,
  [JWTTokenType.refresh]: false,
  [JWTTokenType.guest]: false,
  [JWTTokenType.passwordReset]: false,
  [JWTTokenType.verifyEmail]: false,
  [JWTTokenType.oauthState]: false,
  [JWTTokenType.oauthHandoff]: false,
  [JWTTokenType.oauthLinkHandoff]: false,
};

const jwtPayloadSchema = z.object({
  sub: z.number(),
  email: z.string(),
  tokenType: z.enum(JWTTokenType),
  isImpersonation: z.boolean().optional(),
  /** Absent from credentials issued before generations existed; reads as 0.
   * Drop once they expire. */
  sessionGeneration: z.number().int().optional(),
});

export function generationOf(claims: { sessionGeneration?: number }): number {
  return claims.sessionGeneration ?? 0;
}

/** Mails sent before the tokens carried a tokenType. Drop once they expire. */
const LEGACY_MAILED_TOKEN_TYPE = {
  [JWTTokenType.passwordReset]: "password-reset",
  [JWTTokenType.verifyEmail]: "verify-email",
} as const;

type MailedTokenType = keyof typeof LEGACY_MAILED_TOKEN_TYPE;

const mailedJwtPayloadSchema = z.object({
  sub: z.number(),
  tokenType: z.enum(JWTTokenType).optional(),
  type: z.string().optional(),
});

export interface MailedJwtPayload {
  sub: number;
  tokenType: MailedTokenType;
}

export function extractBearerToken(
  authorization: string | undefined,
): string | undefined {
  const [scheme, token] = authorization?.split(" ") ?? [];
  return scheme === "Bearer" && token ? token : undefined;
}

export function extractAccessToken(request: Request): string | undefined {
  return (
    extractBearerToken(request.headers.authorization) ??
    request.cookies?.[ACCESS_COOKIE]
  );
}

export function extractRefreshTokenFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.[REFRESH_COOKIE];
}

export function extractRefreshToken(request: Request): string | undefined {
  return (
    extractBearerToken(request.headers.authorization) ??
    extractRefreshTokenFromCookie(request)
  );
}

export function extractGuestTokenFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.[GUEST_COOKIE];
}

export function extractOAuthStateFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.[OAUTH_STATE_COOKIE];
}

export function extractAppleUserFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.[APPLE_USER_COOKIE];
}

function extractGuestTokenFromHeader(request: Request): string | undefined {
  const header = request.headers[GUEST_HEADER];
  if (typeof header !== "string" || header.length === 0) {
    return undefined;
  }
  return header;
}

export function extractGuestToken(request: Request): string | undefined {
  return (
    extractGuestTokenFromHeader(request) ?? extractGuestTokenFromCookie(request)
  );
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

export async function verifyRefreshToken(
  jwtService: JwtService,
  token: string,
): Promise<JwtPayload> {
  const payload = jwtPayloadSchema.safeParse(
    await jwtService.verifyAsync(token, {
      secret: process.env.JWT_REFRESH_SECRET,
    }),
  );
  if (!payload.success || payload.data.tokenType !== JWTTokenType.refresh) {
    throw new UnauthorizedException();
  }
  return payload.data;
}

/** The user id a mailed token of `tokenType` names. */
export async function verifyMailedToken(
  jwtService: JwtService,
  params: { token: string; tokenType: MailedTokenType },
): Promise<Result<number>> {
  const verified = await R.fromPromise(
    jwtService.verifyAsync(params.token, { secret: process.env.JWT_SECRET }),
  );
  if (!verified.ok) {
    return verified;
  }
  const payload = mailedJwtPayloadSchema.safeParse(verified.value);
  if (!payload.success) {
    return R.failure(payload.error);
  }
  const { sub, tokenType, type } = payload.data;
  return tokenType === params.tokenType ||
    type === LEGACY_MAILED_TOKEN_TYPE[params.tokenType]
    ? R.success(sub)
    : R.failure(new Error(`not a ${params.tokenType} token`));
}

export function sessionTokenPayload({
  user,
  tokenType,
  isImpersonation,
}: {
  user: { id: number; email: string; sessionGeneration: number };
  tokenType: JWTTokenType.access | JWTTokenType.refresh;
  isImpersonation?: boolean;
}): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    sessionGeneration: user.sessionGeneration,
    tokenType,
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

/**
 * Connected accounts are the member's to change. A link made while
 * impersonating would also let the admin sign in as the member after
 * impersonation ends.
 */
export function refuseImpersonation(session: JwtPayload): void {
  if (session.isImpersonation) {
    throw new ForbiddenException("Not allowed while impersonating.");
  }
}

export interface JwtRequest extends Request {
  user: JwtPayload;
}
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export const guestJwtPayloadSchema = z.object({
  sub: z.string(),
  tokenType: z.literal(JWTTokenType.guest),
});

export type GuestJwtPayload = z.infer<typeof guestJwtPayloadSchema>;
