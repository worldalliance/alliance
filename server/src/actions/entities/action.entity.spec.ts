import { ActionStatus } from "./action-event.entity";
import { ActionFormVariant } from "./action-form-variant.entity";
import {
  Action,
  actionStatusAt,
  loadedActionEvents,
  loadedActionFormVariants,
} from "./action.entity";

describe("actionStatusAt", () => {
  const launch = new Date("2026-02-01");
  const events = [
    { date: new Date("2026-01-01"), newStatus: ActionStatus.Planned },
    { date: launch, newStatus: ActionStatus.MemberAction },
  ];

  it("takes the new event's status at the instant of its date", () => {
    expect(actionStatusAt(events, launch)).toBe(ActionStatus.MemberAction);
  });

  it("keeps the previous status just before that instant", () => {
    expect(actionStatusAt(events, new Date(launch.getTime() - 1))).toBe(
      ActionStatus.Planned,
    );
  });

  it("is Draft before any event", () => {
    expect(actionStatusAt(events, new Date("2025-12-01"))).toBe(
      ActionStatus.Draft,
    );
  });
});

describe("loadedActionEvents", () => {
  it("returns the loaded events", () => {
    expect(loadedActionEvents({ events: [] })).toEqual([]);
  });

  it("throws when the events aren't loaded", () => {
    expect(() => loadedActionEvents({ events: undefined })).toThrow(
      "`events` relation is not loaded",
    );
  });
});

describe("Action.memberActionPhase", () => {
  it("has no phase when the action has no events", () => {
    const action = Object.assign(new Action(), { events: [] });
    expect(action.memberActionPhase).toEqual({
      event: null,
      deadlineEvent: null,
    });
  });

  it("throws when the events aren't loaded", () => {
    expect(() => new Action().memberActionPhase).toThrow(
      "`events` relation is not loaded",
    );
  });
});

describe("loadedActionFormVariants", () => {
  it("returns the loaded variants", () => {
    const formVariants = [new ActionFormVariant()];
    expect(loadedActionFormVariants({ id: 3, formVariants })).toBe(
      formVariants,
    );
  });

  it("throws when the variants aren't loaded", () => {
    expect(() =>
      loadedActionFormVariants({ id: 3, formVariants: undefined }),
    ).toThrow("formVariants of action 3 not loaded");
  });
});
