import { Action, loadedActionEvents } from "./action.entity";

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
