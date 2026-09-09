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
import { extractAccessToken, verifyAccessToken } from "../tokens";

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

    const token = extractAccessToken(request);
    if (!token) {
      request["user"] = undefined;
      return true;
    }

    try {
      request["user"] = await verifyAccessToken(this.jwtService, token);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
