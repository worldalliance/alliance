import { describe, expect, it } from "bun:test";
import { referencedActionFromListItem } from "./referencedAction";

describe("referencedActionFromListItem", () => {
  it("reads the task form, variant and branch forms, onboarding, and member-action deadline", () => {
    expect(
      referencedActionFromListItem({
        id: 1,
        taskFormId: 10,
        variantFormIds: [11, 12],
        branchFormIds: [13],
        onboarding: true,
        memberActionDeadline: "2026-01-02T00:00:00.000Z",
      }),
    ).toEqual({
      id: 1,
      formIds: [10, 11, 12, 13],
      onboarding: true,
      deadline: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  it("has no deadline or task form when the action has neither", () => {
    expect(
      referencedActionFromListItem({
        id: 2,
        taskFormId: null,
        variantFormIds: [],
        branchFormIds: [],
        onboarding: false,
        memberActionDeadline: null,
      }),
    ).toEqual({ id: 2, formIds: [], onboarding: false, deadline: null });
  });
});
