import type { ActionEventDto } from "@alliance/shared/client";
import {
  currentEventIdAt,
  hasMemberActionStartedAt,
} from "./actionEventTiming";

function event(
  id: number,
  date: string,
  newStatus: ActionEventDto["newStatus"],
): ActionEventDto {
  return {
    id,
    title: `event ${id}`,
    description: "",
    newStatus,
    date,
    suiteManaged: false,
  };
}

const draft = event(1, "2026-01-01T00:00:00.000Z", "draft");
const memberAction = event(2, "2026-02-01T00:00:00.000Z", "member_action");
const events = [memberAction, draft];
const justBefore = new Date(new Date(memberAction.date).getTime() - 1);

describe("currentEventIdAt", () => {
  it("is the latest event dated before now", () => {
    expect(currentEventIdAt(events, justBefore)).toBe(draft.id);
  });

  it("includes an event at its exact date", () => {
    expect(currentEventIdAt(events, new Date(memberAction.date))).toBe(
      memberAction.id,
    );
  });

  it("is undefined before the first event", () => {
    expect(currentEventIdAt(events, new Date("2025-12-01"))).toBeUndefined();
  });
});

describe("hasMemberActionStartedAt", () => {
  it("is false before the member-action event", () => {
    expect(hasMemberActionStartedAt(events, justBefore)).toBe(false);
  });

  it("is true at the member-action event's exact date", () => {
    expect(hasMemberActionStartedAt(events, new Date(memberAction.date))).toBe(
      true,
    );
  });
});
