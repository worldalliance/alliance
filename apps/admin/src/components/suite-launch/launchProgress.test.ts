import { afterEach, describe, expect, it } from "bun:test";
import {
  clearLaunchProgress,
  readLaunchProgress,
  writeLaunchProgress,
} from "./launchProgress";

const progress = {
  schedule: {
    memberActionAt: new Date("2026-11-01T02:00:00Z"),
    officeActionAt: new Date("2026-11-08T07:59:00Z"),
  },
  checkedActionIds: new Set([1, 2]),
  dismissedKeys: new Set(["misspelling|grantmaking"]),
  violationsAcknowledged: true,
};

afterEach(() => window.localStorage.clear());

describe("launch progress", () => {
  it("reads back what was written, per suite", () => {
    writeLaunchProgress({ suiteId: 3, progress });
    expect(readLaunchProgress(3)).toEqual(progress);
    expect(readLaunchProgress(4)).toBeNull();
  });

  it("forgets progress once cleared", () => {
    writeLaunchProgress({ suiteId: 3, progress });
    clearLaunchProgress(3);
    expect(readLaunchProgress(3)).toBeNull();
  });

  it("ignores stored progress it can't read", () => {
    window.localStorage.setItem("alliance.suiteLaunch.v1.3", "{not json");
    expect(readLaunchProgress(3)).toBeNull();
    window.localStorage.setItem(
      "alliance.suiteLaunch.v1.3",
      JSON.stringify({ memberActionAt: "soon" }),
    );
    expect(readLaunchProgress(3)).toBeNull();
  });
});
