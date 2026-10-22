import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { refuseImpersonation, type JwtRequest } from "../tokens";

/** Runs after AuthGuard, which puts the session on the request. */
@Injectable()
export class NotImpersonatingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    refuseImpersonation(context.switchToHttp().getRequest<JwtRequest>().user);
    return true;
  }
}
