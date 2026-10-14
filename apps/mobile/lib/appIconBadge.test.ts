import { expect, it, mock, spyOn } from "bun:test";
import { keepsAppIconBadgeClear, writeAppIconBadge } from "./appIconBadge";

it("sets every count on iOS", async () => {
  const set = mock(async (_count: number) => true);
  const clearAndroid = mock(async () => {});

  await writeAppIconBadge({ os: "ios", count: 0, set, clearAndroid });
  await writeAppIconBadge({ os: "ios", count: 3, set, clearAndroid });

  expect(set.mock.calls).toEqual([[0], [3]]);
  expect(clearAndroid).not.toHaveBeenCalled();
});

it("clears a zero on Android through the module, never expo-notifications", async () => {
  const set = mock(async (_count: number) => true);
  const clearAndroid = mock(async () => {});

  await writeAppIconBadge({ os: "android", count: 0, set, clearAndroid });
  expect(clearAndroid).toHaveBeenCalledTimes(1);
  expect(set).not.toHaveBeenCalled();

  await writeAppIconBadge({ os: "android", count: 3, set, clearAndroid });
  expect(set).toHaveBeenCalledWith(3);
  expect(clearAndroid).toHaveBeenCalledTimes(1);
});

it("logs a failed write instead of rejecting", async () => {
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const set = mock(() => Promise.reject(new Error("no permission")));
  const clearAndroid = mock(() => Promise.reject(new Error("no context")));

  await writeAppIconBadge({ os: "android", count: 0, set, clearAndroid });
  await writeAppIconBadge({ os: "ios", count: 3, set, clearAndroid });

  expect(logged).toHaveBeenCalledTimes(2);
  logged.mockRestore();
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
