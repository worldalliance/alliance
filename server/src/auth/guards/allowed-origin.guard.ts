import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { isAllowedOrigin } from "../allowed-origins";

/**
 * Refuses a request another site's page sent. CORS lets any origin read
 * responses, so on routes that change a cookie session this check is what
 * stops cross-site submissions. Browsers send `Origin` on every method but
 * GET and HEAD, so this guard does not suit those.
 */
@Injectable()
export class AllowedOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (!origin || !isAllowedOrigin(origin)) {
      throw new ForbiddenException("Request from an unrecognized site");
    }
    return true;
  }
}
