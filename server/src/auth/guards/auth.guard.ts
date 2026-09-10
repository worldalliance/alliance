import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { requestContext } from "src/utils/request-context";
import { IS_PUBLIC_KEY } from "../public.decorator";
import { sessionFromRequest } from "../tokens";

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

    try {
      const payload = await sessionFromRequest(this.jwtService, request);
      request["user"] = payload;
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
