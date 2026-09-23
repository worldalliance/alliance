import { OAuthProvider, parseOAuthProvider } from "@alliance/common/oauth";
import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";

/**
 * Not a `@Param` with a pipe: Bun emits the enum object as the parameter's
 * design type, and the global ValidationPipe then tries to validate the string
 * as an instance of it.
 */
export const ProviderParam = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): OAuthProvider => {
    const provider = parseOAuthProvider(
      ctx.switchToHttp().getRequest<ExpressRequest>().params.provider,
    );
    if (!provider) {
      throw new BadRequestException("unknown sign-in provider");
    }
    return provider;
  },
);
