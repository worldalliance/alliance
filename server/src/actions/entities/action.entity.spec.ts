import { ActionFormVariant } from "./action-form-variant.entity";
import {
  Action,
  loadedActionEvents,
  loadedActionFormVariants,
} from "./action.entity";

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
