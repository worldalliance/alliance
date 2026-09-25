import { describe, expect, it } from "bun:test";
import { ActionStatusBucket, actionStatusBucket } from "./actionStatusBucket";

describe("actionStatusBucket", () => {
  it("maps statuses to buckets", () => {
    expect(
      actionStatusBucket({ status: "member_action", onboarding: false }),
    ).toBe(ActionStatusBucket.Active);
    expect(actionStatusBucket({ status: "draft", onboarding: false })).toBe(
      ActionStatusBucket.Draft,
    );
    expect(actionStatusBucket({ status: "completed", onboarding: false })).toBe(
      ActionStatusBucket.Completed,
    );
    for (const status of [
      "planned",
      "office_action",
      "resolution",
      "failed",
      "abandoned",
    ] as const) {
      expect(actionStatusBucket({ status, onboarding: false })).toBe(
        ActionStatusBucket.Pending,
      );
    }
  });

  it("puts onboarding actions in Onboarding whatever their status", () => {
    for (const status of ["draft", "member_action", "completed"] as const) {
      expect(actionStatusBucket({ status, onboarding: true })).toBe(
        ActionStatusBucket.Onboarding,
      );
    }
  });
});
