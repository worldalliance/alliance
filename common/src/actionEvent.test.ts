import {
  eventInEffectAt,
  findStartedMemberActionEvent,
  hasMemberActionStarted,
  hasTakenEffect,
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
