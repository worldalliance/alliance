import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { JwtPayload, JwtRequest } from "./tokens";

export const ReqUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<JwtRequest>();
    return request.user;
  },
);
