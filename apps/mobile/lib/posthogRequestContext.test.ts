import { PostHogPersistedProperty } from "@posthog/core";
import { describe, expect, it } from "bun:test";
import { hoursToMilliseconds, minutesToMilliseconds } from "date-fns";
import { posthogRequestContext } from "./posthogRequestContext";

const sessionId = "01900000-0000-7000-8000-000000000001";

const sdk = (params: {
  optedOut: boolean;
  sessionId?: string;
  idleMinutes?: number;
  ageHours?: number;
}) => ({
  optedOut: params.optedOut,
  getPersistedProperty: (key: PostHogPersistedProperty) => {
    switch (key) {
      case PostHogPersistedProperty.SessionId:
        return params.sessionId;
      case PostHogPersistedProperty.SessionLastTimestamp:
        return params.idleMinutes === undefined
          ? undefined
          : Date.now() - minutesToMilliseconds(params.idleMinutes);
      case PostHogPersistedProperty.SessionStartTimestamp:
        return params.idleMinutes === undefined
          ? undefined
          : Date.now() - hoursToMilliseconds(params.ageHours ?? 1);
      default:
        return undefined;
    }
  },
  getDistinctId: () => "7",
});

describe("posthogRequestContext", () => {
  it("forwards the session and distinct id", () => {
    expect(
      posthogRequestContext(
        sdk({ optedOut: false, sessionId, idleMinutes: 29 }),
      ),
    ).toEqual({ sessionId, distinctId: "7" });
  });

  it("forwards no session once it has idled out", () => {
    expect(
      posthogRequestContext(
        sdk({ optedOut: false, sessionId, idleMinutes: 31 }),
      ),
    ).toEqual({ sessionId: undefined, distinctId: "7" });
  });

  it("forwards no session past its maximum length", () => {
    expect(
      posthogRequestContext(
        sdk({ optedOut: false, sessionId, idleMinutes: 0, ageHours: 25 }),
      ),
    ).toEqual({ sessionId: undefined, distinctId: "7" });
  });

  it("forwards no session before one starts", () => {
    expect(posthogRequestContext(sdk({ optedOut: false }))).toEqual({
      sessionId: undefined,
      distinctId: "7",
    });
  });

  it("forwards nothing for an opted-out user", () => {
    expect(
      posthogRequestContext(sdk({ optedOut: true, sessionId, idleMinutes: 0 })),
    ).toBeUndefined();
  });
});
