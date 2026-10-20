import { expect, it } from "bun:test";
import { formatBadgeCount } from "./badgeCount";

it("shows no badge for zero", () => {
  expect(formatBadgeCount(0)).toBeNull();
});

it("shows the exact count from 1 to 99", () => {
  expect(formatBadgeCount(1)).toBe("1");
  expect(formatBadgeCount(99)).toBe("99");
});

it("caps counts above 99 at 99+", () => {
  expect(formatBadgeCount(100)).toBe("99+");
  expect(formatBadgeCount(150)).toBe("99+");
});
