import { afterEach, describe, expect, it, spyOn } from "bun:test";
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
    [1, "2026-10-30T18:00:00.000Z|4"],
    [2, "2026-10-30T18:05:00.000Z|"],
  ]),
  dismissedKeys: new Set(["misspelling|grantmaking"]),
  acceptedViolations: new Set(["Members get 6 days to finish."]),
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
    window.localStorage.setItem("alliance.suiteLaunch.v2.3", "{not json");
    expect(readLaunchProgress(3)).toBeNull();
    window.localStorage.setItem(
      "alliance.suiteLaunch.v2.3",
      JSON.stringify({ memberActionAt: "soon" }),
    );
    expect(readLaunchProgress(3)).toBeNull();
  });
});

it("treats storage the browser blocks as no saved progress", () => {
  const blocked = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  const reads = spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
  const removes = spyOn(Storage.prototype, "removeItem").mockImplementation(
    blocked,
  );

  expect(readLaunchProgress(3)).toBeNull();
  expect(() => clearLaunchProgress(3)).not.toThrow();
  reads.mockRestore();
  removes.mockRestore();
});
