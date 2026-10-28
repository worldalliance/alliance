import { ForbiddenException } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { AllowedOriginGuard } from "./allowed-origin.guard";

const APP_URL = "https://app.example.org";

const canActivate = (origin: string | undefined) =>
  new AllowedOriginGuard().canActivate(
    new ExecutionContextHost([{ headers: { origin } }]),
  );

describe("AllowedOriginGuard", () => {
  const previous = process.env.APP_URL;
  beforeAll(() => {
    process.env.APP_URL = APP_URL;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  });

  it("lets the site's own pages through", () => {
    expect(canActivate(APP_URL)).toBe(true);
  });

  it("refuses another site, or a request naming none", () => {
    expect(() => canActivate("https://app.example.org.evil.example")).toThrow(
      ForbiddenException,
    );
    expect(() => canActivate(undefined)).toThrow(ForbiddenException);
  });
});
