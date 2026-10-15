import { ActionEvent, ActionStatus } from "../entities/action-event.entity";
import {
  eventInEffectAt,
  hasTakenEffect,
  memberActionPhase,
  shortensMemberActionDeadline,
} from "./action-event";

function event(id: number, date: string, newStatus: ActionStatus): ActionEvent {
  return { id, date: new Date(date), newStatus } as ActionEvent;
}

describe("hasTakenEffect", () => {
  const date = new Date("2026-02-01");

  it("is false before the event's date", () => {
    expect(hasTakenEffect(date, new Date(date.getTime() - 1))).toBe(false);
  });

  it("is true at the event's date", () => {
    expect(hasTakenEffect(date, date)).toBe(true);
  });
});

describe("eventInEffectAt", () => {
  const planned = event(1, "2026-01-01", ActionStatus.Planned);
  const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
  const resolution = event(3, "2026-03-01", ActionStatus.Resolution);
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
});

describe("memberActionPhase", () => {
  it("returns nulls when there is no member-action event", () => {
    const events = [
      event(1, "2026-01-01", ActionStatus.Planned),
      event(2, "2026-02-01", ActionStatus.OfficeAction),
    ];
    expect(memberActionPhase(events)).toEqual({
      event: null,
      deadlineEvent: null,
    });
  });

  it("returns the member-action event and the first event after it", () => {
    const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
    const resolution = event(3, "2026-03-01", ActionStatus.Resolution);
    const events = [
      event(1, "2026-01-01", ActionStatus.Planned),
      memberAction,
      resolution,
      event(4, "2026-04-01", ActionStatus.Completed),
    ];
    expect(memberActionPhase(events)).toEqual({
      event: memberAction,
      deadlineEvent: resolution,
    });
  });

  it("returns a null deadline when the member-action event is the last event", () => {
    const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
    const events = [event(1, "2026-01-01", ActionStatus.Planned), memberAction];
    expect(memberActionPhase(events)).toEqual({
      event: memberAction,
      deadlineEvent: null,
    });
  });

  it("ignores event order in the input array", () => {
    const memberAction = event(2, "2026-02-01", ActionStatus.MemberAction);
    const resolution = event(3, "2026-03-01", ActionStatus.Resolution);
    const events = [resolution, memberAction];
    expect(memberActionPhase(events)).toEqual({
      event: memberAction,
      deadlineEvent: resolution,
    });
  });
});

describe("shortensMemberActionDeadline", () => {
  const start = event(1, "2026-02-01", ActionStatus.MemberAction);
  const phase = (deadline: string | null) =>
    memberActionPhase(
      deadline ? [start, event(2, deadline, ActionStatus.Resolution)] : [start],
    );

  it("is true when the deadline moves earlier", () => {
    expect(
      shortensMemberActionDeadline(phase("2026-03-01"), phase("2026-02-15")),
    ).toBe(true);
  });

  it("is false when the deadline moves later or stays", () => {
    expect(
      shortensMemberActionDeadline(phase("2026-03-01"), phase("2026-04-01")),
    ).toBe(false);
    expect(
      shortensMemberActionDeadline(phase("2026-03-01"), phase("2026-03-01")),
    ).toBe(false);
  });

  it("is true when a phase without a deadline gets one", () => {
    expect(shortensMemberActionDeadline(phase(null), phase("2026-03-01"))).toBe(
      true,
    );
  });

  it("is false when the deadline is removed", () => {
    expect(shortensMemberActionDeadline(phase("2026-03-01"), phase(null))).toBe(
      false,
    );
  });
});
