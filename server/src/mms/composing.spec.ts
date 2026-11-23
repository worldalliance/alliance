import { COMPOSING_TTL_MS } from "@alliance/common/mmsThreads";
import { ComposingRegistry } from "./composing";

const sam = { phoneNumber: "+14155550001", adminId: 10, adminName: "Sam" };

describe("ComposingRegistry", () => {
  let changes: number;
  let registry: ComposingRegistry;

  beforeEach(() => {
    jest.useFakeTimers();
    changes = 0;
    registry = new ComposingRegistry(() => changes++);
  });

  afterEach(() => {
    registry.clear();
    jest.useRealTimers();
  });

  it("announces a new composer once, not on each refresh", () => {
    registry.report("a", sam);
    registry.report("a", sam);
    expect(registry.composers()).toEqual([sam]);
    expect(changes).toBe(1);
  });

  it("expires a report that isn't refreshed", () => {
    registry.report("a", sam);
    jest.advanceTimersByTime(COMPOSING_TTL_MS - 1);
    registry.report("a", sam);
    jest.advanceTimersByTime(COMPOSING_TTL_MS - 1);
    expect(registry.composers()).toEqual([sam]);
    jest.advanceTimersByTime(1);
    expect(registry.composers()).toEqual([]);
    expect(changes).toBe(2);
  });

  it("lists an admin composing from two tabs once, until both stop", () => {
    registry.report("a", sam);
    registry.report("b", sam);
    expect(registry.composers()).toEqual([sam]);
    registry.stop("a", sam.phoneNumber);
    expect(registry.composers()).toEqual([sam]);
    registry.disconnect("b");
    expect(registry.composers()).toEqual([]);
  });

  it("drops only the disconnected socket's reports", () => {
    const priya = {
      phoneNumber: "+14155550002",
      adminId: 11,
      adminName: "Priya",
    };
    registry.report("a", sam);
    registry.report("ab", priya);
    registry.disconnect("a");
    expect(registry.composers()).toEqual([priya]);
  });

  it("announces nothing when stopping a report it doesn't hold", () => {
    registry.stop("a", sam.phoneNumber);
    registry.disconnect("a");
    expect(changes).toBe(0);
  });
});
