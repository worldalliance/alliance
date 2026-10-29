import { expect, it } from "bun:test";
import { actionUpdateStatus, ActionUpdateStatus } from "./actionUpdateStatus";

it("sorts updates into draft, scheduled, and published by when members see them", () => {
  const now = new Date("2026-10-29T12:00:00Z");

  expect(actionUpdateStatus({ visibleAt: null }, now)).toBe(
    ActionUpdateStatus.Draft,
  );
  expect(actionUpdateStatus({ visibleAt: "2026-11-01T00:00:00Z" }, now)).toBe(
    ActionUpdateStatus.Scheduled,
  );
  expect(actionUpdateStatus({ visibleAt: "2026-10-29T12:00:00Z" }, now)).toBe(
    ActionUpdateStatus.Published,
  );
});
