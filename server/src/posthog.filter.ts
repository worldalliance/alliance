import {
  ArgumentsHost,
  Catch,
  HttpException,
  type INestApplication,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AbstractHttpAdapter,
  BaseExceptionFilter,
  HttpAdapterHost,
} from "@nestjs/core";
import type { Request } from "express";
import { PostHog } from "posthog-node";

@Catch()
export class PosthogExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly posthog: PostHog,
    applicationRef: AbstractHttpAdapter,
  ) {
    super(applicationRef);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    if (
      exception instanceof NotFoundException ||
      exception instanceof UnauthorizedException //TODO: figure out actual filtering desired here
    ) {
      return super.catch(exception, host);
    }

    const posthogSessionId = req.headers["x-posthog-session-id"] ?? undefined;

    // Bypasses the typed `captureEvent` wrapper.
    this.posthog.captureException(exception, "server", {
      event: "$exception",
      properties: {
        message:
          exception instanceof Error ? exception.message : "Unknown error",
        name: exception instanceof Error ? exception.name : "Unknown error",
        stack: exception instanceof Error ? exception.stack : "Unknown error",
        path: req?.url,
        method: req?.method,
        status,
        env: process.env.NODE_ENV,
        $session_id: posthogSessionId,
        server: true,
      },
    });

    return super.catch(exception, host);
  }
}

/** The filter also sees body-parser errors, so an Express error handler beside it would capture those twice. */
export function capturePosthogExceptions(
  app: INestApplication,
  client: PostHog,
): void {
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PosthogExceptionFilter(client, httpAdapter));
}
