import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import {
  extractRefreshTokenFromCookie,
  type JwtPayload,
  JWTTokenType,
} from "./jwtreq";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token =
      extractRefreshTokenFromCookie(request) ??
      this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      if (payload.tokenType !== JWTTokenType.refresh) {
        console.log("invalid token type");
        throw new UnauthorizedException("Invalid token type");
      }

      // Attach user info to request for later use
      request["user"] = payload;
      request["refreshToken"] = token;

      return true;
    } catch (err) {
      console.log("refresh token guard error: ", err);
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers["authorization"] as string | undefined;
    if (!authHeader) {
      return undefined;
    }
    return authHeader.split(" ")[1];
  }
}
