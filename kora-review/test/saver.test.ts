import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaver } from "../src/saver.js";

function deferred() {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("createSaver", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("debounces: one save about two seconds after the last change", async () => {
    let n = 0;
    const save = vi.fn(async (v: number) => { void v; });
    const s = createSaver({ build: () => ++n, save, onFailed: vi.fn(), onRecovered: vi.fn() });
    s.changed();
    await vi.advanceTimersByTimeAsync(1500);
    s.changed();
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(1);
  });

  it("never has more than one save in flight, and saves changes made during a save once it settles", async () => {
    const pending: ReturnType<typeof deferred>[] = [];
    let inFlight = 0, maxInFlight = 0, n = 0;
    const save = vi.fn((v: number) => {
      void v;
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      const d = deferred(); pending.push(d);
      return d.promise.finally(() => { inFlight--; });
    });
    const s = createSaver({ build: () => ++n, save, onFailed: vi.fn(), onRecovered: vi.fn() });
    s.changed();
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);

    s.changed();                                  // arrives mid-save
    await vi.advanceTimersByTimeAsync(5000);      // its debounce fires while the first save is still in flight
    expect(save).toHaveBeenCalledTimes(1);

    pending[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);        // saved again as soon as the first settled
    expect(save).toHaveBeenLastCalledWith(2);
    pending[1]!.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
  });

  it("keeps state after a failed save, retries on the next change, and reports recovery once", async () => {
    let fail = true, n = 0;
    const saved: number[] = [];
    const onFailed = vi.fn(), onRecovered = vi.fn();
    const s = createSaver({
      build: () => ++n,
      save: async (v: number) => { if (fail) throw new Error("refused"); saved.push(v); },
      onFailed, onRecovered,
    });
    s.changed();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(s.dirty).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);    // no retry loop on its own
    expect(n).toBe(1);

    fail = false;
    s.changed();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual([2]);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(s.dirty).toBe(false);

    s.changed();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onRecovered).toHaveBeenCalledTimes(1); // only after a failure
  });

  it("flush saves immediately, and rejects when that save fails", async () => {
    let fail = false;
    const save = vi.fn(async () => { if (fail) throw new Error("refused"); });
    const s = createSaver({ build: () => 1, save, onFailed: vi.fn(), onRecovered: vi.fn() });
    await s.flush();                               // nothing pending: no save
    expect(save).not.toHaveBeenCalled();
    s.changed();
    await s.flush();
    expect(save).toHaveBeenCalledTimes(1);
    fail = true;
    s.changed();
    await expect(s.flush()).rejects.toThrow("refused");
    fail = false;
    await s.flush();                               // retries the failed save
    expect(save).toHaveBeenCalledTimes(3);
  });
});
