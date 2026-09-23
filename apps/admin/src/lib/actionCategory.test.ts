import { describe, expect, it } from "bun:test";
import { ActionCategory, actionCategory } from "./actionCategory";

describe("actionCategory", () => {
  it("maps statuses to categories", () => {
    expect(actionCategory({ status: "member_action", onboarding: false })).toBe(
      ActionCategory.Active,
    );
    expect(actionCategory({ status: "draft", onboarding: false })).toBe(
      ActionCategory.Draft,
    );
    expect(actionCategory({ status: "completed", onboarding: false })).toBe(
      ActionCategory.Completed,
    );
    for (const status of [
      "planned",
      "office_action",
      "resolution",
      "failed",
      "abandoned",
    ] as const) {
      expect(actionCategory({ status, onboarding: false })).toBe(
        ActionCategory.Pending,
      );
    }
  });

  it("puts onboarding actions in Onboarding whatever their status", () => {
    for (const status of ["draft", "member_action", "completed"] as const) {
      expect(actionCategory({ status, onboarding: true })).toBe(
        ActionCategory.Onboarding,
      );
    }
  });
});
