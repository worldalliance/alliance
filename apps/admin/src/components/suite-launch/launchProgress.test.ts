import { R } from "@alliance/common/result";
import { afterEach, describe, expect, it } from "bun:test";
import { blockStorage } from "../../lib/testing/blockStorage";
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
  readyActionVersions: new Map([
    [1, '[["Call"],4,[]]'],
    [2, '[["Write"],null,[]]'],
  ]),
  dismissedKeys: new Set(["misspelling|teh"]),
  acceptedViolations: new Set(["Members get 6 days to finish."]),
};

afterEach(() => window.localStorage.clear());

describe("launch progress", () => {
  it("reads back what was written, per suite", () => {
    expect(writeLaunchProgress({ suiteId: 3, progress }).ok).toBe(true);
    expect(readLaunchProgress(3)).toEqual(R.success(progress));
    expect(readLaunchProgress(4)).toEqual(R.success(null));
  });

  it("reads back a schedule staff never edited as none", () => {
    writeLaunchProgress({
      suiteId: 3,
      progress: { ...progress, schedule: null },
    });
    expect(readLaunchProgress(3)).toEqual(
      R.success({ ...progress, schedule: null }),
    );
  });

  it("forgets progress once cleared", () => {
    writeLaunchProgress({ suiteId: 3, progress });
    clearLaunchProgress(3);
    expect(readLaunchProgress(3)).toEqual(R.success(null));
  });

  it("fails to read stored progress it can't parse", () => {
    window.localStorage.setItem("alliance.suiteLaunch.v2.3", "{not json");
    expect(readLaunchProgress(3).ok).toBe(false);
    window.localStorage.setItem(
      "alliance.suiteLaunch.v2.3",
      JSON.stringify({ schedule: { memberActionAt: "soon" } }),
    );
    expect(readLaunchProgress(3).ok).toBe(false);
  });

  it("fails, without throwing, where the browser blocks storage", () => {
    const restore = blockStorage();
    try {
      expect(readLaunchProgress(3).ok).toBe(false);
      expect(writeLaunchProgress({ suiteId: 3, progress }).ok).toBe(false);
      expect(clearLaunchProgress(3).ok).toBe(false);
    } finally {
      restore();
    }
  });
});
