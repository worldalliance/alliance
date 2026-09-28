import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { extractRefreshToken, verifyRefreshToken } from "../tokens";

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
      request["user"] = await verifyRefreshToken(this.jwtService, token);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }
}
