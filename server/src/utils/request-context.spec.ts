import {
  POSTHOG_DISTINCT_HEADER,
  POSTHOG_SESSION_HEADER,
} from "@alliance/common/posthog";
import {
  adoptPosthogContext,
  createRequestContext,
  requestContext,
  type RequestContext,
} from "./request-context";

describe("PostHog request headers", () => {
  const sessionId = "01900000-0000-7000-8000-000000000001";
  const context = (
    headers: Parameters<typeof createRequestContext>[0]["headers"],
  ) =>
    createRequestContext({
      method: "POST",
      originalUrl: "/actions/12",
      headers,
    });

  it("accepts the SDK identifiers without treating them as authentication", () => {
    const result = context({
      [POSTHOG_SESSION_HEADER]: sessionId,
      [POSTHOG_DISTINCT_HEADER]: "7",
    });
    expect(result.posthog).toEqual({ sessionId, distinctId: "7" });
    expect(result.userId).toBeUndefined();
    expect(result.requestId).toEqual(expect.any(String));
  });

  it("allows clients without PostHog", () => {
    expect(context({}).posthog).toEqual({});
  });

  it.each([
    { [POSTHOG_SESSION_HEADER]: "not-a-session" },
    { [POSTHOG_SESSION_HEADER]: [sessionId, sessionId] },
    { [POSTHOG_DISTINCT_HEADER]: "" },
    { [POSTHOG_DISTINCT_HEADER]: "x".repeat(201) },
    { [POSTHOG_DISTINCT_HEADER]: ["7", "8"] },
  ])(
    "ignores invalid telemetry without rejecting the request: %j",
    (headers) => {
      expect(context(headers).posthog).toEqual({});
    },
  );

  it("keeps a valid identifier when the other is malformed", () => {
    expect(
      context({
        [POSTHOG_SESSION_HEADER]: sessionId,
        [POSTHOG_DISTINCT_HEADER]: "x".repeat(201),
      }).posthog,
    ).toEqual({ sessionId });
  });
});

describe("adoptPosthogContext", () => {
  const sessionId = "01900000-0000-7000-8000-000000000001";

  it("replaces the request's identifiers with valid ones", () => {
    const context: RequestContext = {
      requestId: "callback",
      method: "GET",
      url: "/auth/google/callback",
      posthog: {},
    };
    requestContext.run(context, () =>
      adoptPosthogContext({ sessionId, distinctId: "x".repeat(201) }),
    );
    expect(context.posthog).toEqual({ sessionId });
  });
});
