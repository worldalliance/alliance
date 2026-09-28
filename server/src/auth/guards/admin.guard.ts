import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { User } from "src/user/entities/user.entity";
import type { Repository } from "typeorm";
import { sessionFromRequest } from "../tokens";
import { attachSession } from "./attach-session";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    try {
      const payload = await sessionFromRequest(this.jwtService, request);
      attachSession(request, payload);

      const user = await this.userRepository.findOne({
        where: { email: payload.email },
      });

      if (!user) {
        console.log("admin guard failed");
        throw new UnauthorizedException();
      }
      if (!user.admin) {
        console.log("user is not admin");
        throw new UnauthorizedException();
      }
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
