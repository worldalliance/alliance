import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload, JwtRequest } from './guards/auth.guard';

export const ReqUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<JwtRequest>();
    return request.user;
  },
);
