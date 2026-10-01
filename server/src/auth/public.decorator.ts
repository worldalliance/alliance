import { type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const isPublicRoute = (
  reflector: Reflector,
  context: ExecutionContext,
): boolean =>
  reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]) ?? false;
