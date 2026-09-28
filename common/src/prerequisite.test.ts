import { describe, expect, it } from "bun:test";
import {
  checkPrerequisiteDeadline,
  PrerequisiteDeadlineProblem,
} from "./prerequisite";

const monday = new Date("2026-01-05T00:00:00Z");
const tuesday = new Date("2026-01-06T00:00:00Z");

describe("checkPrerequisiteDeadline", () => {
  it("accepts an upstream due before its dependent", () => {
    expect(
      checkPrerequisiteDeadline({ upstream: monday, dependent: tuesday }).ok,
    ).toBe(true);
  });

  it("accepts any upstream deadline when the dependent has none", () => {
    expect(
      checkPrerequisiteDeadline({ upstream: tuesday, dependent: null }).ok,
    ).toBe(true);
  });

  it("rejects an upstream without a deadline", () => {
    expect(
      checkPrerequisiteDeadline({ upstream: null, dependent: tuesday }),
    ).toEqual({ ok: false, error: PrerequisiteDeadlineProblem.Missing });
  });

  it("rejects an upstream due at or after its dependent", () => {
    for (const upstream of [tuesday, new Date("2026-01-07T00:00:00Z")]) {
      expect(
        checkPrerequisiteDeadline({ upstream, dependent: tuesday }),
      ).toEqual({ ok: false, error: PrerequisiteDeadlineProblem.NotFirst });
    }
  });
});
