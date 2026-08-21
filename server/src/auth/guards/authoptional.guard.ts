import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../public.decorator";
import type { JwtPayload } from "./jwtreq";

@Injectable()
export class AuthOptionalGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    let token = extractAccessTokenFromCookie(request);

    if (!token) {
      token = extractTokenFromHeader(request);
      if (!token) {
        request["user"] = undefined;
        return true;
      }
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      request["user"] = payload;
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
export function extractAccessTokenFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.access_token;
}

export function extractRefreshTokenFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.refresh_token;
}

export function extractTokenFromHeader(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(" ") ?? [];
  return type === "Bearer" ? token : undefined;
}
