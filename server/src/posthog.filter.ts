import {
  ArgumentsHost,
  Catch,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { PostHog } from 'posthog-node';

@Catch()
export class PosthogExceptionFilter extends BaseExceptionFilter {
  constructor(private readonly posthog: PostHog) {
    super();
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

    const posthogSessionId = req.headers['X-POSTHOG-SESSION-ID'] ?? undefined;

    this.posthog.captureException(exception, 'server', {
      event: '$exception',
      properties: {
        message:
          exception instanceof Error ? exception.message : 'Unknown error',
        name: exception instanceof Error ? exception.name : 'Unknown error',
        stack: exception instanceof Error ? exception.stack : 'Unknown error',
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
