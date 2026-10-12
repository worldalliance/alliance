import { expect, it } from "bun:test";
import {
  AppIconBadgeWrite,
  appIconBadgeWrite,
  keepsAppIconBadgeClear,
} from "./appIconBadge";

it("sets the count on iOS", () => {
  expect(appIconBadgeWrite("ios")).toBe(AppIconBadgeWrite.Set);
});

it("leaves the Android icon alone", () => {
  expect(appIconBadgeWrite("android")).toBe(AppIconBadgeWrite.Skip);
});

it("keeps the icon clear only once signed out", () => {
  const signedOut = {
    isLoading: false,
    isAuthenticated: false,
    sessionUnavailable: false,
  };
  expect(keepsAppIconBadgeClear(signedOut)).toBe(true);
  expect(keepsAppIconBadgeClear({ ...signedOut, isLoading: true })).toBe(false);
  expect(keepsAppIconBadgeClear({ ...signedOut, isAuthenticated: true })).toBe(
    false,
  );
  expect(
    keepsAppIconBadgeClear({ ...signedOut, sessionUnavailable: true }),
  ).toBe(false);
});
