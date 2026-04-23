import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../public.decorator';
import { requestContext } from 'src/utils/request-context';
import { JWTTokenType, type JwtPayload } from './jwtreq';

@Injectable()
export class AuthGuard implements CanActivate {
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

    let token = extractTokenFromHeader(request);

    if (!token) {
      token = extractAccessTokenFromCookie(request);
      if (!token) {
        throw new UnauthorizedException();
      }
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      if (payload.tokenType === JWTTokenType.guest) {
        throw new UnauthorizedException();
      }
      request['user'] = payload;
      const ctx = requestContext.getStore();
      if (ctx) {
        ctx.userId = payload.sub;
      }
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

export function extractGuestTokenFromCookie(
  request: Request,
): string | undefined {
  return request.cookies?.guest_token;
}

export function extractGuestTokenFromHeader(
  request: Request,
): string | undefined {
  const header = request.headers['x-guest-token'];
  if (typeof header !== 'string' || header.length === 0) {
    return undefined;
  }
  return header;
}

export function extractTokenFromHeader(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}
