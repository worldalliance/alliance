import { MOBILE_STORE_FINGERPRINTS } from "@alliance/common/mobileFingerprints.gen";
import { Controller, Get, Header, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { HealthCheckDto, MobileFingerprintsDto } from "./app.dto";
import { Public } from "./auth/public.decorator";
import { register } from "./metrics";

@Controller()
export class AppController {
  constructor() {}

  @Public()
  @Get("/")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HealthCheckDto })
  healthCheck(): HealthCheckDto {
    return new HealthCheckDto("OK");
  }

  @Public()
  @Get("/mobile-fingerprints")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: MobileFingerprintsDto })
  getMobileFingerprints(): MobileFingerprintsDto {
    return new MobileFingerprintsDto(MOBILE_STORE_FINGERPRINTS);
  }

  /**
   * Prometheus scrape target: returns the exposition text format, so the body
   * must stay as a primitive string rather than a DTO — JSON-wrapping it would
   * break scraping.
   */
  @Get("/metrics")
  @Header("Content-Type", register.contentType)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: String })
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
