import {
  AnalyticsEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";
import { PostHog } from "posthog-node";
import { captureEvent, captureException } from "./posthog";
import { requestContext } from "./request-context";
import { AppTypeOrmLogger } from "./typeorm-logger";

describe("backend PostHog event sessions", () => {
  afterEach(() => jest.restoreAllMocks());

  it("links slow queries to the same identity used by the frontend", () => {
    const apiKey = process.env.POSTHOG_KEY;
    const capture = jest
      .spyOn(PostHog.prototype, "capture")
      .mockImplementation(() => {});
    let logger: AppTypeOrmLogger;
    try {
      process.env.POSTHOG_KEY = "test-key";
      logger = new AppTypeOrmLogger();
    } finally {
      if (apiKey === undefined) delete process.env.POSTHOG_KEY;
      else process.env.POSTHOG_KEY = apiKey;
    }
    const sessionId = "01900000-0000-7000-8000-000000000001";
    requestContext.run(
      {
        requestId: "slow-request",
        method: "GET",
        url: "/",
        userId: 7,
        posthog: { sessionId, distinctId: "7" },
      },
      () => logger.logQuerySlow(600, "SELECT 1"),
    );
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: AnalyticsEvent.DbSlowQuery,
        distinctId: "7",
        properties: expect.objectContaining({
          $session_id: sessionId,
          $process_person_profile: false,
        }),
      }),
    );
  });

  it("attaches the originating session without nesting or mutating properties", () => {
    const capture = jest.fn();
    const properties = { actionId: 12 };
    requestContext.run(
      {
        requestId: "request-a",
        method: "POST",
        url: "/actions/12",
        userId: 7,
        posthog: {
          sessionId: "01900000-0000-7000-8000-000000000001",
          distinctId: "7",
        },
      },
      () =>
        captureEvent({
          client: { capture },
          distinctId: "7",
          event: AnalyticsEvent.ActionCompleted,
          properties,
        }),
    );

    expect(capture).toHaveBeenCalledWith({
      distinctId: "7",
      event: AnalyticsEvent.ActionCompleted,
      properties: {
        actionId: 12,
        $session_id: "01900000-0000-7000-8000-000000000001",
        [SLACK_PROPERTY]: SEND_TO_SLACK[AnalyticsEvent.ActionCompleted],
      },
    });
    expect(properties).toEqual({ actionId: 12 });
  });

  it("keeps explicit event identity for login and actions affecting another user", () => {
    const capture = jest.fn();
    requestContext.run(
      {
        requestId: "admin",
        method: "POST",
        url: "/contract",
        userId: 7,
        posthog: {
          sessionId: "01900000-0000-7000-8000-000000000001",
          distinctId: "7",
        },
      },
      () =>
        captureEvent({
          client: { capture },
          event: AnalyticsEvent.ContractSuspended,
          distinctId: "8",
        }),
    );
    expect(capture.mock.calls[0][0]).toMatchObject({
      distinctId: "8",
      properties: { $session_id: "01900000-0000-7000-8000-000000000001" },
    });
  });

  it("keeps concurrent requests and background work separate across awaits", async () => {
    const capture = jest.fn();
    let releaseFirst = () => {};
    const secondFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const send = () =>
      captureEvent({
        client: { capture },
        event: AnalyticsEvent.DbSlowQuery,
        properties: { $process_person_profile: false },
      });
    const first = requestContext.run(
      {
        requestId: "first",
        method: "GET",
        url: "/",
        userId: 7,
        posthog: {
          sessionId: "01900000-0000-7000-8000-000000000001",
          distinctId: "7",
        },
      },
      async () => {
        await secondFinished;
        send();
      },
    );
    await requestContext.run(
      {
        requestId: "second",
        method: "GET",
        url: "/",
        posthog: {
          sessionId: "01900000-0000-7000-8000-000000000002",
          distinctId: "anonymous",
        },
      },
      async () => {
        await Promise.resolve();
        send();
      },
    );
    releaseFirst();
    await first;
    send();

    expect(
      capture.mock.calls.map(([event]) => [
        event.distinctId,
        event.properties.$session_id,
      ]),
    ).toEqual([
      ["anonymous", "01900000-0000-7000-8000-000000000002"],
      ["7", "01900000-0000-7000-8000-000000000001"],
      ["server", undefined],
    ]);
    expect(
      capture.mock.calls.every(
        ([event]) => event.properties.$process_person_profile === false,
      ),
    ).toBe(true);
  });

  it("does not create a session for an authenticated client without recording", () => {
    const capture = jest.fn();
    requestContext.run(
      { requestId: "unrecorded", method: "GET", url: "/", userId: 7 },
      () =>
        captureEvent({
          client: { capture },
          event: AnalyticsEvent.DbSlowQuery,
        }),
    );
    expect(capture.mock.calls[0][0].distinctId).toBe("7");
    expect(capture.mock.calls[0][0].properties).not.toHaveProperty(
      "$session_id",
    );
  });

  it("attributes anonymous exceptions and leaves background exceptions unlinked", () => {
    const sendException = jest.fn();
    const error = new Error("test failure");
    const send = () =>
      captureException({
        client: { captureException: sendException },
        error,
        properties: { fieldId: "test-field" },
      });
    requestContext.run(
      {
        requestId: "anonymous",
        method: "GET",
        url: "/",
        posthog: {
          distinctId: "anonymous",
          sessionId: "01900000-0000-7000-8000-000000000001",
        },
      },
      send,
    );
    send();
    expect(sendException.mock.calls).toEqual([
      [
        error,
        "anonymous",
        {
          fieldId: "test-field",
          $process_person_profile: false,
          $session_id: "01900000-0000-7000-8000-000000000001",
        },
      ],
      [error, "server", { fieldId: "test-field" }],
    ]);
  });

  it("keeps person processing for an explicit identity on an anonymous request", () => {
    const capture = jest.fn();
    requestContext.run(
      {
        requestId: "login",
        method: "POST",
        url: "/auth/login",
        posthog: { distinctId: "anonymous" },
      },
      () =>
        captureEvent({
          client: { capture },
          event: AnalyticsEvent.Login,
          distinctId: "8",
        }),
    );
    expect(capture.mock.calls[0][0].distinctId).toBe("8");
    expect(capture.mock.calls[0][0].properties).not.toHaveProperty(
      "$process_person_profile",
    );
  });
});
