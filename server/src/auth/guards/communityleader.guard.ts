import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { UserService } from "../../user/user.service";
import { sessionFromRequest } from "../tokens";
import { attachSession } from "./attach-session";

@Injectable()
export class CommunityLeaderGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const payload = await sessionFromRequest(this.jwtService, request);
      attachSession(request, payload);

      const isLeader = await this.userService.isCommunityLeader(payload.email);
      const isAdmin = await this.userService.isAdmin(payload.sub);

      if (!isLeader && !isAdmin) {
        throw new UnauthorizedException();
      }
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
