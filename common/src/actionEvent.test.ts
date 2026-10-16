import {
  eventInEffectAt,
  findStartedMemberActionEvent,
  hasMemberActionStarted,
  hasTakenEffect,
  memberActionPhase,
} from "./actionEvent";

describe("hasTakenEffect", () => {
  const date = new Date("2026-02-01");

  it("is false before the event's date", () => {
    expect(hasTakenEffect(date, new Date(date.getTime() - 1))).toBe(false);
  });

  it("is true at the event's date", () => {
    expect(hasTakenEffect(date, date)).toBe(true);
  });

  it("accepts a serialized date", () => {
    expect(hasTakenEffect(date.toISOString(), date)).toBe(true);
  });
});

describe("eventInEffectAt", () => {
  const planned = { id: 1, date: new Date("2026-01-01") };
  const memberAction = { id: 2, date: new Date("2026-02-01") };
  const resolution = { id: 3, date: new Date("2026-03-01") };
  const events = [resolution, planned, memberAction];

  it("is the new event at the instant of its date", () => {
    expect(eventInEffectAt(events, memberAction.date)).toEqual({
      event: memberAction,
      nextEvent: resolution,
    });
  });

  it("is the previous event just before that instant", () => {
    expect(
      eventInEffectAt(events, new Date(memberAction.date.getTime() - 1)),
    ).toEqual({ event: planned, nextEvent: memberAction });
  });

  it("is none before the first event", () => {
    expect(eventInEffectAt(events, new Date("2025-12-01"))).toEqual({
      event: null,
      nextEvent: planned,
    });
  });

  it("has no next event once the last one takes effect", () => {
    expect(eventInEffectAt(events, resolution.date)).toEqual({
      event: resolution,
      nextEvent: null,
    });
  });

  it("orders serialized dates by time", () => {
    const serialized = events.map((event) => ({
      ...event,
      date: event.date.toISOString(),
    }));
    expect(eventInEffectAt(serialized, memberAction.date)).toEqual({
      event: serialized[2],
      nextEvent: serialized[0],
    });
  });
});

describe("hasMemberActionStarted", () => {
  const planned = { date: "2026-01-01T00:00:00.000Z", newStatus: "planned" };
  const memberAction = {
    date: "2026-02-01T00:00:00.000Z",
    newStatus: "member_action",
  };
  const events = [memberAction, planned];

  it("is false before the member-action event", () => {
    expect(
      hasMemberActionStarted(
        events,
        new Date(new Date(memberAction.date).getTime() - 1),
      ),
    ).toBe(false);
  });

  it("is true at the member-action event's exact date", () => {
    expect(hasMemberActionStarted(events, new Date(memberAction.date))).toBe(
      true,
    );
  });

  it("ignores other events that have taken effect", () => {
    expect(hasMemberActionStarted(events, new Date("2026-01-15"))).toBe(false);
  });

  it("finds the started member-action event", () => {
    expect(
      findStartedMemberActionEvent(events, new Date(memberAction.date)),
    ).toBe(memberAction);
  });
});

describe("memberActionPhase", () => {
  const event = (id: number, date: string, newStatus: string) => ({
    id,
    date,
    newStatus,
  });
  const planned = event(1, "2026-01-01T00:00:00.000Z", "planned");
  const memberAction = event(2, "2026-02-01T00:00:00.000Z", "member_action");
  const resolution = event(3, "2026-03-01T00:00:00.000Z", "resolution");
  const completed = event(4, "2026-04-01T00:00:00.000Z", "completed");

  it("is empty without a member-action event", () => {
    expect(memberActionPhase([planned, resolution])).toEqual({
      event: null,
      deadlineEvent: null,
    });
  });

  it("closes at the earliest event after the member-action event, whatever the array order", () => {
    expect(
      memberActionPhase([completed, resolution, memberAction, planned]),
    ).toEqual({ event: memberAction, deadlineEvent: resolution });
  });

  it("skips an event at the member-action event's own instant", () => {
    const sameInstant = event(5, memberAction.date, "office_action");
    expect(memberActionPhase([memberAction, sameInstant, resolution])).toEqual({
      event: memberAction,
      deadlineEvent: resolution,
    });
  });

  it("has no deadline when the member-action event is the last event", () => {
    expect(memberActionPhase([planned, memberAction])).toEqual({
      event: memberAction,
      deadlineEvent: null,
    });
  });
});
