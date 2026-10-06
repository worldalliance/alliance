import { R } from "@alliance/common/result";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { SessionService } from "../session.service";
import { extractRefreshToken, verifyRefreshToken } from "../tokens";
import { attachSession } from "./attach-session";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = extractRefreshToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const session = await R.fromPromise(
      verifyRefreshToken(this.jwtService, token),
    );
    if (!session.ok) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
    await this.sessionService.assertCurrent(session.value);
    attachSession(request, session.value);
    return true;
  }
}
