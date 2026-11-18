import { AnalyticsEvent, ExceptionEvent } from "@alliance/common/analytics";
import {
  __resetAnalyticsForTests,
  captureEvent,
  captureException,
  registerAnalytics,
  type AnalyticsBackend,
} from "./analytics";

describe("a backend that throws", () => {
  beforeEach(__resetAnalyticsForTests);

  const throwingBackend: AnalyticsBackend = {
    capture: () => {
      throw new Error("posthog blew up");
    },
    captureException: () => {
      throw new Error("posthog blew up");
    },
  };

  it("does not take captureEvent's caller down with it", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    registerAnalytics(throwingBackend);

    expect(() => captureEvent(AnalyticsEvent.Login)).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not take captureException's caller down with it", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    registerAnalytics(throwingBackend);

    expect(() =>
      captureException(ExceptionEvent.PostReplyError, new Error("boom")),
    ).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("keeps replaying the buffer after one queued call throws", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    captureEvent(AnalyticsEvent.Login);
    captureEvent(AnalyticsEvent.Logout);

    const seen: string[] = [];
    registerAnalytics({
      capture: (event) => {
        seen.push(event);
        if (event === AnalyticsEvent.Login) throw new Error("posthog blew up");
      },
      captureException: () => {},
    });

    expect(seen).toEqual([AnalyticsEvent.Login, AnalyticsEvent.Logout]);
  });
});
