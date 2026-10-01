import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { isPublicRoute } from "../public.decorator";
import { extractAccessToken } from "../tokens";
import { attachAccessSession } from "./attach-session";

@Injectable()
export class AuthOptionalGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const token = extractAccessToken(request);
    if (!token) {
      request["user"] = undefined;
      return true;
    }

    await attachAccessSession({ jwtService: this.jwtService, request, token });
    return true;
  }
}
