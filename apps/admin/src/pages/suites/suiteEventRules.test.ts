import { describe, expect, it } from "bun:test";
import {
  deletePhases,
  editConsequence,
  EventChange,
  phaseChangeText,
} from "./suiteEventRules";

const now = new Date("2026-11-25T12:00:00Z");
const start = {
  id: 1,
  newStatus: "member_action" as const,
  date: "2026-11-27T03:00:00Z",
};
const deadline = {
  id: 2,
  newStatus: "office_action" as const,
  date: "2026-12-04T07:59:00Z",
};
const events = [start, deadline];

describe("editConsequence", () => {
  it("is quiet when the date is unchanged", () => {
    expect(
      editConsequence({ event: start, date: start.date, events, now }),
    ).toEqual({ change: EventChange.Quiet });
  });

  it("launches when a future members start moves to the past", () => {
    expect(
      editConsequence({
        event: start,
        date: "2026-11-25T11:00:00Z",
        events,
        now,
      }),
    ).toEqual({ change: EventChange.Launch });
  });

  it("launches when a future members start moves to exactly now", () => {
    expect(
      editConsequence({ event: start, date: now.toISOString(), events, now }),
    ).toEqual({ change: EventChange.Launch });
  });

  it("names an earlier members start that is still to come", () => {
    expect(
      editConsequence({
        event: start,
        date: "2026-11-26T03:00:00Z",
        events,
        now,
      }),
    ).toEqual({ change: EventChange.EarlierStart, from: start.date });
  });

  it("is quiet when a future members start moves later", () => {
    expect(
      editConsequence({
        event: start,
        date: "2026-11-28T03:00:00Z",
        events,
        now,
      }),
    ).toEqual({ change: EventChange.Quiet });
  });

  it("names the phase change when another event moves into the past", () => {
    const launched = [{ ...start, date: "2026-11-20T03:00:00Z" }, deadline];
    expect(
      editConsequence({
        event: deadline,
        date: "2026-11-24T00:00:00Z",
        events: launched,
        now,
      }),
    ).toEqual({
      change: EventChange.PhaseNow,
      from: "member_action",
      to: "office_action",
    });
  });

  it("names the return to Draft when a past members start moves ahead", () => {
    const launched = [{ ...start, date: "2026-11-20T03:00:00Z" }, deadline];
    expect(
      editConsequence({
        event: launched[0],
        date: "2026-11-30T03:00:00Z",
        events: launched,
        now,
      }),
    ).toEqual({
      change: EventChange.PhaseNow,
      from: "member_action",
      to: "draft",
    });
  });
});

describe("deletePhases", () => {
  it("returns a launched suite to Draft when its start goes", () => {
    const launched = [{ ...start, date: "2026-11-20T03:00:00Z" }, deadline];
    expect(deletePhases({ event: launched[0], events: launched, now })).toEqual(
      { from: "member_action", to: "draft" },
    );
  });

  it("leaves the phase when a future event goes", () => {
    expect(deletePhases({ event: deadline, events, now })).toEqual({
      from: "draft",
      to: "draft",
    });
  });
});

describe("phaseChangeText", () => {
  it("says the tasks become visible out of Draft", () => {
    expect(phaseChangeText({ from: "draft", to: "member_action" })).toBe(
      "Every task in this suite moves from Draft to Members taking action now. Members the tasks are visible to can see them from now on.",
    );
  });

  it("says the tasks are hidden back in Draft", () => {
    expect(phaseChangeText({ from: "member_action", to: "draft" })).toContain(
      "Members can no longer see a task",
    );
  });
});
