import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOkResponse, ApiServiceUnavailableResponse } from "@nestjs/swagger";
import { DataSource } from "typeorm";
import { HealthCheckDto } from "../app.dto";
import { Public } from "../auth/public.decorator";

export const DB_READINESS_TIMEOUT_MS = 2_000;

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Answers through the application's pool, so a starved pool fails it. */
  @Public()
  @Get("db")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HealthCheckDto })
  @ApiServiceUnavailableResponse()
  async db(): Promise<HealthCheckDto> {
    const result = await withTimeout(
      this.dataSource.query("SELECT 1").then(
        () => true,
        (err: unknown) => {
          this.logger.warn(`Database readiness query failed: ${String(err)}`);
          return false;
        },
      ),
      DB_READINESS_TIMEOUT_MS,
    );
    if (result !== true) {
      throw new ServiceUnavailableException(
        result === TIMED_OUT ? "Database timed out" : "Database query failed",
      );
    }
    return new HealthCheckDto("OK");
  }
}
