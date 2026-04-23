/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger as TypeOrmLogger } from 'typeorm';
import { Logger as NestLogger } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import client from 'prom-client';
import { register } from '../metrics';
import { requestContext } from './request-context';

const dbQueryTotal = new client.Counter({
  name: 'db_query_total',
  help: 'Total number of database queries executed',
  labelNames: ['type'],
});

const dbSlowQueryDurationSeconds = new client.Histogram({
  name: 'db_slow_query_duration_seconds',
  help: 'Duration of slow database queries in seconds',
  labelNames: ['type', 'source'],
  buckets: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
});

register.registerMetric(dbQueryTotal);
register.registerMetric(dbSlowQueryDurationSeconds);

function getQueryType(query: string): string {
  const firstWord = query.trim().split(/\s+/)[0]?.toUpperCase();
  if (firstWord === 'SELECT') return 'SELECT';
  if (firstWord === 'INSERT') return 'INSERT';
  if (firstWord === 'UPDATE') return 'UPDATE';
  if (firstWord === 'DELETE') return 'DELETE';
  return 'OTHER';
}

export class AppTypeOrmLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger('TypeORM');
  private readonly client?: PostHog;

  constructor() {
    if (!process.env.POSTHOG_KEY) {
      return;
    }
    this.client = new PostHog(process.env.POSTHOG_KEY!, {
      host: 'https://us.i.posthog.com',
    });
  }

  logQuery(query: string) {
    const type = getQueryType(query);
    dbQueryTotal.labels(type).inc();
  }

  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    const ctx = requestContext.getStore();
    this.logger.error({
      event: 'db.query_error',
      sql: query,
      params: this.safeParams(parameters),
      error: error instanceof Error ? error.message : error,
      request_id: ctx?.requestId,
      request_method: ctx?.method,
      request_url: ctx?.url,
      request_user_id: ctx?.userId,
    });
  }

  logQuerySlow(time: number, query: string) {
    const obj: any = {};
    Error.captureStackTrace(obj, this.logQuerySlow);
    const stack: string = obj.stack;

    const serviceStackLines = stack
      .split('\n')
      .filter((line) => line.includes('.service.ts'))
      .join('\n')
      .trim();

    const controllerStackLines = stack
      .split('\n')
      .filter((line) => line.includes('controller'))
      .join('\n')
      .trim();

    let shortServiceName = serviceStackLines.substring(
      0,
      serviceStackLines.indexOf('.service.ts'),
    );
    shortServiceName = shortServiceName.substring(
      shortServiceName.lastIndexOf('/') + 1,
    );

    let shortControllerName = controllerStackLines.substring(
      0,
      controllerStackLines.indexOf('.controller.ts'),
    );
    shortControllerName = shortControllerName.substring(
      shortControllerName.lastIndexOf('/') + 1,
    );

    const source = shortServiceName || shortControllerName || 'unknown';

    const type = getQueryType(query);
    dbSlowQueryDurationSeconds.labels(type, source).observe(time / 1000);

    if (!this.client) return;

    const ctx = requestContext.getStore();

    this.client.capture({
      distinctId: ctx?.userId ? `user:${ctx.userId}` : 'server',
      event: 'db.slow_query',
      properties: {
        durationMs: time,
        sql: query,
        full_trace: stack,
        service_trace: serviceStackLines,
        controller_trace: controllerStackLines,
        request_id: ctx?.requestId,
        request_method: ctx?.method,
        request_url: ctx?.url,
        request_user_id: ctx?.userId,
      },
    });
  }

  logSchemaBuild(message: string) {
    this.logger.log({ event: 'db.schema_build', message });
  }

  logMigration(message: string) {
    this.logger.log({ event: 'db.migration', message });
  }

  log(level: 'log' | 'info' | 'warn', message: any) {
    if (level === 'warn') this.logger.warn(message);
    else this.logger.log(message);
  }

  private safeParams(params?: any[]) {
    if (!params) return undefined;
    return params.map((p) => {
      if (typeof p === 'string' && p.length > 256) return '[long-string]';
      return p;
    });
  }
}
