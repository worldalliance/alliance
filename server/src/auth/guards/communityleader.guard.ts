import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { SessionService } from "../session.service";
import { sessionFromRequest } from "../tokens";
import { attachSession } from "./attach-session";

@Injectable()
export class CommunityLeaderGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const payload = await sessionFromRequest(this.jwtService, request);
      attachSession(request, payload);

      const user = await this.sessionService.currentUser(payload);
      if (!user.isCommunityLeader && !user.admin) {
        throw new UnauthorizedException();
      }
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
