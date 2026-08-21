import type { ValidationPipeOptions } from "@nestjs/common";

/** Keeps production and e2e DTO transformation aligned. */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  disableErrorMessages: false,
  forbidUnknownValues: true,
  transform: true,
  whitelist: true,
};
