import {
  actionEventRefetchTimestamps,
  actionStatusReflectsPastEvents,
  EVENT_REFETCH_SKEW_MS,
  msUntilNextTimestamp,
} from "./useOnNextDeadline";

const NOW = 1_000_000;

describe("msUntilNextTimestamp", () => {
  it("returns the delay to the soonest future timestamp", () => {
    expect(msUntilNextTimestamp([NOW + 500, NOW + 200, NOW + 900], NOW)).toBe(
      200,
    );
  });

  it("ignores past timestamps and nullish entries", () => {
    expect(
      msUntilNextTimestamp([NOW - 100, null, undefined, NOW + 300], NOW),
    ).toBe(300);
  });

  it("treats a timestamp exactly at now as passed", () => {
    expect(msUntilNextTimestamp([NOW], NOW)).toBeNull();
  });

  it("returns null when nothing is in the future", () => {
    expect(msUntilNextTimestamp([], NOW)).toBeNull();
    expect(msUntilNextTimestamp([NOW - 1, null], NOW)).toBeNull();
  });
});

describe("actionEventRefetchTimestamps", () => {
  it("maps event dates to skew-buffered timestamps", () => {
    const action = {
      events: [
        { date: new Date(NOW).toISOString() },
        { date: new Date(NOW + 5_000).toISOString() },
      ],
    };
    expect(actionEventRefetchTimestamps(action)).toEqual([
      NOW + EVENT_REFETCH_SKEW_MS,
      NOW + 5_000 + EVENT_REFETCH_SKEW_MS,
    ]);
  });

  it("returns no timestamps for a not-yet-loaded action", () => {
    expect(actionEventRefetchTimestamps(null)).toEqual([]);
  });

  it("refetches after the boundary, not at it (clock-skew buffer)", () => {
    const action = { events: [{ date: new Date(NOW).toISOString() }] };
    const [timestamp] = actionEventRefetchTimestamps(action);
    // At the boundary itself the timer must still be pending…
    expect(msUntilNextTimestamp([timestamp], NOW)).toBe(EVENT_REFETCH_SKEW_MS);
    // …and once the buffer elapses there is nothing left to wait for.
    expect(
      msUntilNextTimestamp([timestamp], NOW + EVENT_REFETCH_SKEW_MS),
    ).toBeNull();
  });
});

describe("actionStatusReflectsPastEvents", () => {
  const PAST = NOW - 10_000;
  const FUTURE = NOW + 10_000;

  function event(
    date: number,
    newStatus: string,
  ): {
    date: string;
    newStatus: string;
  } {
    return { date: new Date(date).toISOString(), newStatus };
  }

  it("acknowledges a payload matching the latest client-past event", () => {
    const action = {
      status: "member_action",
      // Unsorted on purpose — the server returns events in storage order.
      events: [event(PAST, "member_action"), event(PAST - 5_000, "gathering")],
    };
    expect(actionStatusReflectsPastEvents(action, NOW)).toBe(true);
  });

  it("flags a payload still on the old side of a passed boundary", () => {
    const action = {
      status: "gathering",
      events: [event(PAST - 5_000, "gathering"), event(PAST, "member_action")],
    };
    expect(actionStatusReflectsPastEvents(action, NOW)).toBe(false);
  });

  it("flags a draft payload once any boundary has passed", () => {
    const action = {
      status: "draft",
      events: [event(PAST, "member_action")],
    };
    expect(actionStatusReflectsPastEvents(action, NOW)).toBe(false);
  });

  it("treats a boundary as client-past only after the skew buffer", () => {
    const action = {
      status: "gathering",
      events: [
        event(NOW - EVENT_REFETCH_SKEW_MS, "gathering"),
        event(NOW, "member_action"),
      ],
    };
    // The member_action boundary is inside the buffer: not yet expected.
    expect(actionStatusReflectsPastEvents(action, NOW)).toBe(true);
    expect(
      actionStatusReflectsPastEvents(action, NOW + EVENT_REFETCH_SKEW_MS),
    ).toBe(false);
  });

  it("acknowledges a server ahead of the client (slow client clock)", () => {
    const action = {
      status: "resolution",
      events: [
        event(PAST, "member_action"),
        // Client-future, but the server already crossed it.
        event(FUTURE, "resolution"),
      ],
    };
    expect(actionStatusReflectsPastEvents(action, NOW)).toBe(true);
  });

  it("matches a repeated status to its latest event (re-scheduled phase)", () => {
    const action = {
      status: "member_action",
      events: [
        event(PAST - 10_000, "member_action"),
        event(PAST - 5_000, "resolution"),
        event(PAST, "member_action"),
      ],
    };
    expect(actionStatusReflectsPastEvents(action, NOW)).toBe(true);
  });

  it("acknowledges trivially when nothing is client-past", () => {
    expect(
      actionStatusReflectsPastEvents({ status: "draft", events: [] }, NOW),
    ).toBe(true);
    expect(
      actionStatusReflectsPastEvents(
        { status: "draft", events: [event(FUTURE, "member_action")] },
        NOW,
      ),
    ).toBe(true);
  });
});
