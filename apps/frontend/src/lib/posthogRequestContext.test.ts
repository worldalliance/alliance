import { describe, expect, it } from "bun:test";
import { minutesToMilliseconds } from "date-fns";
import { posthogRequestContext } from "./posthogRequestContext";

const sessionId = "01900000-0000-7000-8000-000000000001";

const sdk = (state: {
  loaded: boolean;
  optedOut: boolean;
  idleMinutes?: number;
}) => ({
  __loaded: state.loaded,
  has_opted_out_capturing: () => state.optedOut,
  get_distinct_id: () => "7",
  get_property: (name: string) =>
    name === "$sesid" && state.idleMinutes !== undefined
      ? [
          Date.now() - minutesToMilliseconds(state.idleMinutes),
          sessionId,
          Date.now() - minutesToMilliseconds(60),
        ]
      : undefined,
  sessionManager: { sessionTimeoutMs: minutesToMilliseconds(30) },
});

describe("posthogRequestContext", () => {
  it("forwards the stored session and distinct id", () => {
    expect(
      posthogRequestContext(
        sdk({ loaded: true, optedOut: false, idleMinutes: 29 }),
      ),
    ).toEqual({ sessionId, distinctId: "7" });
  });

  it("forwards no session once it has idled out", () => {
    expect(
      posthogRequestContext(
        sdk({ loaded: true, optedOut: false, idleMinutes: 31 }),
      ),
    ).toEqual({ sessionId: undefined, distinctId: "7" });
  });

  it("forwards no session when none is stored", () => {
    expect(
      posthogRequestContext(sdk({ loaded: true, optedOut: false })),
    ).toEqual({ sessionId: undefined, distinctId: "7" });
  });

  it("forwards nothing for an opted-out user", () => {
    expect(
      posthogRequestContext(
        sdk({ loaded: true, optedOut: true, idleMinutes: 0 }),
      ),
    ).toBeUndefined();
  });

  it("forwards nothing before PostHog loads", () => {
    expect(
      posthogRequestContext(sdk({ loaded: false, optedOut: false })),
    ).toBeUndefined();
  });
});
