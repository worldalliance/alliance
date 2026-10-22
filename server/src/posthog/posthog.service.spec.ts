import {
  AnalyticsEvent,
  ExceptionEvent,
  SEND_TO_SLACK,
  SLACK_PROPERTY,
} from "@alliance/common/analytics";
import { PostHog } from "posthog-node";
import { requestContext } from "../utils/request-context";
import { PosthogService } from "./posthog.service";

describe("PosthogService request attribution", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the same session for product events and manually captured exceptions", async () => {
    const nodeEnv = process.env.NODE_ENV;
    const apiKey = process.env.POSTHOG_KEY;
    const capture = jest
      .spyOn(PostHog.prototype, "capture")
      .mockImplementation(() => {});
    const captureException = jest
      .spyOn(PostHog.prototype, "captureException")
      .mockImplementation(() => {});
    let service: PosthogService;
    try {
      process.env.NODE_ENV = "production";
      process.env.POSTHOG_KEY = "test-key";
      service = new PosthogService();
    } finally {
      if (nodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = nodeEnv;
      if (apiKey === undefined) delete process.env.POSTHOG_KEY;
      else process.env.POSTHOG_KEY = apiKey;
    }

    const error = new Error("malformed test answer");
    const sessionId = "01900000-0000-7000-8000-000000000001";
    try {
      requestContext.run(
        {
          requestId: "test-request",
          method: "POST",
          url: "/actions/12",
          userId: 7,
          posthog: { sessionId, distinctId: "7" },
        },
        () => {
          service.capture({
            event: AnalyticsEvent.ActionCompleted,
            distinctId: "7",
            properties: { actionId: 12 },
          });
          service.captureException({
            event: ExceptionEvent.MalformedListAnswer,
            error,
            properties: { formResponseId: 12 },
          });
        },
      );
      expect(capture.mock.calls[0][0]).toMatchObject({
        distinctId: "7",
        properties: { $session_id: sessionId },
      });
      expect(captureException).toHaveBeenCalledWith(error, "7", {
        event: ExceptionEvent.MalformedListAnswer,
        formResponseId: 12,
        $session_id: sessionId,
        [SLACK_PROPERTY]: SEND_TO_SLACK[ExceptionEvent.MalformedListAnswer],
      });
    } finally {
      await service.onModuleDestroy();
    }
  });
});
