import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { millisecondsInSecond } from "date-fns/constants";
import client from "prom-client";
import { Observable, tap } from "rxjs";

export const register = new client.Registry();

// Optional: collect Node process metrics automatically
client.collectDefaultMetrics({ register });

// Example: define an HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
});

// Register it
register.registerMetric(httpRequestDuration);

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const start = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const seconds = (performance.now() - start) / millisecondsInSecond;
          const route = req.route?.path || req.path;
          httpRequestDuration
            .labels(req.method, route, req.res.statusCode)
            .observe(seconds);
        },
        error: (err: unknown) => {
          const seconds = (performance.now() - start) / millisecondsInSecond;
          const route = req.route?.path || req.path;

          let statusCode = req.res.statusCode;

          if (err instanceof HttpException) {
            statusCode = err.getStatus();
          }

          httpRequestDuration
            .labels(req.method, route, statusCode.toString())
            .observe(seconds);
        },
      }),
    );
  }
}
