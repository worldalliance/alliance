/* eslint-disable @typescript-eslint/no-explicit-any */
import { AnalyticsEvent } from "@alliance/common/analytics";
import { Logger as NestLogger } from "@nestjs/common";
import { PostHog } from "posthog-node";
import client from "prom-client";
import { Logger as TypeOrmLogger } from "typeorm";
import { register } from "../metrics";
import { captureEvent } from "./posthog";
import { requestContext } from "./request-context";

const dbQueryTotal = new client.Counter({
  name: "db_query_total",
  help: "Total number of database queries executed",
  labelNames: ["type"],
});

const dbSlowQueryDurationSeconds = new client.Histogram({
  name: "db_slow_query_duration_seconds",
  help: "Duration of slow database queries in seconds",
  labelNames: ["type", "source"],
  buckets: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
});

register.registerMetric(dbQueryTotal);
register.registerMetric(dbSlowQueryDurationSeconds);

/** Keep billed PostHog events to the slow-query tail. */
const POSTHOG_SLOW_QUERY_MS = 500;

function getQueryType(query: string): string {
  const firstWord = query.trim().split(/\s+/)[0]?.toUpperCase();
  if (firstWord === "SELECT") return "SELECT";
  if (firstWord === "INSERT") return "INSERT";
  if (firstWord === "UPDATE") return "UPDATE";
  if (firstWord === "DELETE") return "DELETE";
  return "OTHER";
}

export class AppTypeOrmLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger("TypeORM");
  private readonly client?: PostHog;

  constructor() {
    if (!process.env.POSTHOG_KEY) {
      return;
    }
    this.client = new PostHog(process.env.POSTHOG_KEY!, {
      host: "https://us.i.posthog.com",
    });
  }

  logQuery(query: string) {
    const type = getQueryType(query);
    dbQueryTotal.labels(type).inc();
  }

  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    const ctx = requestContext.getStore();
    this.logger.error({
      event: "db.query_error",
      sql: query,
      params: this.safeParams(parameters),
      error: error instanceof Error ? error.message : error,
      handler: ctx?.handler,
      request_id: ctx?.requestId,
      request_method: ctx?.method,
      request_url: ctx?.url,
      request_user_id: ctx?.userId,
    });
  }

  logQuerySlow(time: number, query: string) {
    const ctx = requestContext.getStore();
    // Route pattern, not the raw URL — this is a Prometheus label and must
    // stay bounded-cardinality. Cron/startup queries have no request context.
    const source = ctx ? (ctx.route ?? "http") : "background";

    const type = getQueryType(query);
    dbSlowQueryDurationSeconds.labels(type, source).observe(time / 1000);

    if (!this.client) return;
    if (time < POSTHOG_SLOW_QUERY_MS) return;

    captureEvent({
      client: this.client,
      distinctId: ctx?.userId ? `user:${ctx.userId}` : "server",
      event: AnalyticsEvent.DbSlowQuery,
      properties: {
        $process_person_profile: false,
        durationMs: time,
        sql: query,
        source,
        handler: ctx?.handler,
        request_id: ctx?.requestId,
        request_method: ctx?.method,
        request_url: ctx?.url,
        request_user_id: ctx?.userId,
      },
    });
  }

  logSchemaBuild(message: string) {
    this.logger.log({ event: "db.schema_build", message });
  }

  logMigration(message: string) {
    this.logger.log({ event: "db.migration", message });
  }

  log(level: "log" | "info" | "warn", message: any) {
    if (level === "warn") this.logger.warn(message);
    else this.logger.log(message);
  }

  private safeParams(params?: any[]) {
    if (!params) return undefined;
    return params.map((p) => {
      if (typeof p === "string" && p.length > 256) return "[long-string]";
      return p;
    });
  }
}
