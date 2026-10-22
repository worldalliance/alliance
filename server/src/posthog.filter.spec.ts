import { BadRequestException } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { ExpressAdapter } from "@nestjs/platform-express";
import { PostHog } from "posthog-node";
import { PosthogExceptionFilter } from "./posthog.filter";
import { requestContext } from "./utils/request-context";

describe("PosthogExceptionFilter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("links a validation error to its authenticated user and session", () => {
    const posthog = new PostHog("test-key", { disabled: true });
    const capture = jest
      .spyOn(posthog, "captureException")
      .mockImplementation(() => {});
    const adapter = new ExpressAdapter();
    jest.spyOn(adapter, "reply").mockImplementation(() => {});
    const filter = new PosthogExceptionFilter(posthog, adapter);
    const sessionId = "01900000-0000-7000-8000-000000000001";
    const host = new ExecutionContextHost([
      { url: "/user/away", method: "POST" },
      { headersSent: false },
    ]);
    const error = new BadRequestException("Start date must be in the future.");

    requestContext.run(
      {
        requestId: "request-a",
        method: "POST",
        url: "/user/away",
        userId: 7,
        posthog: { sessionId, distinctId: "anonymous-browser" },
      },
      () => filter.catch(error, host),
    );

    expect(capture).toHaveBeenCalledWith(
      error,
      "7",
      expect.objectContaining({
        $session_id: sessionId,
        status: 400,
        path: "/user/away",
        server: true,
      }),
    );
    expect(capture.mock.calls[0][2]).not.toHaveProperty("properties");
  });
});
