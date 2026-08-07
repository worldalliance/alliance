import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from './guards/jwtreq';
import type { JwtRequest } from './guards/jwtreq';

export const ReqUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<JwtRequest>();
    return request.user;
  },
);
