import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { requestContext } from "./request-context";

/**
 * Stamps the matched route pattern and controller handler onto the request
 * context so DB instrumentation (see typeorm-logger.ts) can attribute
 * queries to an endpoint. Registered as a global guard rather than an
 * interceptor: global guards run before controller-bound guards, so queries
 * issued by e.g. AdminGuard are attributed too.
 */
@Injectable()
export class RouteContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const ctx = requestContext.getStore();
    if (ctx) {
      ctx.route = context.switchToHttp().getRequest().route?.path;
      ctx.handler = `${context.getClass().name}.${context.getHandler().name}`;
    }
    return true;
  }
}
