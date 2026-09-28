import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { extractRefreshToken, verifyRefreshToken } from "../tokens";
import { attachSession } from "./attach-session";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = extractRefreshToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }

    try {
      attachSession(request, await verifyRefreshToken(this.jwtService, token));
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }
}
