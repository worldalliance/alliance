import { TIMED_OUT, withTimeout } from "./timeout";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// By delay, not by the last call: other timers get scheduled in between, and
// clearing one of those would satisfy a bare toHaveBeenCalled().
const trackTimers = () => {
  const scheduling = jest.spyOn(globalThis, "setTimeout");
  const clearing = jest.spyOn(globalThis, "clearTimeout");

  return {
    clearing,
    handleFor: (ms: number) => {
      const ours = scheduling.mock.calls.findIndex(([, delay]) => delay === ms);
      if (ours < 0) {
        throw new Error(`no ${ms}ms timer was scheduled`);
      }
      return scheduling.mock.results[ours].value;
    },
  };
};

describe("withTimeout", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("gives the promise its value when it lands first", async () => {
    expect(await withTimeout(Promise.resolve("sent"), 1000)).toBe("sent");
  });

  it("gives up at the deadline rather than waiting on the promise", async () => {
    let settled = false;
    let letItFinish = () => {};
    const stalled = new Promise<void>((r) => {
      letItFinish = () => {
        settled = true;
        r();
      };
    });

    expect(await withTimeout(stalled, 20)).toBe(TIMED_OUT);
    expect(settled).toBe(false);

    letItFinish();
  });

  it("passes a rejection through to the caller", async () => {
    const error = new Error("network down");

    await expect(withTimeout(Promise.reject(error), 1000)).rejects.toBe(error);
  });

  it("keeps a rejection that lands after the deadline from going unhandled", async () => {
    let fail = (_: Error) => {};
    const stalled = new Promise<void>((_, reject) => {
      fail = reject;
    });

    expect(await withTimeout(stalled, 20)).toBe(TIMED_OUT);
    fail(new Error("network down"));
    await delay(10);

    // Green is the assertion: bun fails a test that leaves a rejection
    // unhandled. Promise.race subscribed to the promise, so the late rejection
    // lands on a capability that already settled and goes nowhere. A rewrite
    // dropping the race would have every slow call on React Native reporting
    // itself to the app's error reporting as a crash.
  });

  it("throws on a NaN deadline, rather than timing out at once", async () => {
    await expect(
      withTimeout(Promise.resolve("sent"), Number.NaN),
    ).rejects.toThrow("got NaN");
  });

  it("throws on a negative deadline, which is already past", async () => {
    await expect(withTimeout(Promise.resolve("sent"), -1)).rejects.toThrow(
      "got -1",
    );
  });

  it("keeps a rejected deadline from stranding the promise's rejection", async () => {
    // Green is the assertion again: nothing subscribes to the promise before
    // the guard throws, so the rejection below would go unhandled without the
    // catch withTimeout attaches.
    const failing = Promise.reject(new Error("network down"));

    await expect(withTimeout(failing, Number.NaN)).rejects.toThrow("got NaN");
    await delay(10);
  });

  it("clamps a deadline setTimeout can't hold, rather than firing at once", async () => {
    const scheduling = jest.spyOn(globalThis, "setTimeout");

    expect(await withTimeout(Promise.resolve("sent"), 2 ** 31)).toBe("sent");
    expect(scheduling).toHaveBeenCalledWith(expect.any(Function), 2 ** 31 - 1);

    await withTimeout(Promise.resolve("sent"), Number.POSITIVE_INFINITY);
    expect(scheduling).toHaveBeenLastCalledWith(
      expect.any(Function),
      2 ** 31 - 1,
    );
  });

  it("clears the timer the promise beat, so nothing holds the runtime open", async () => {
    const timers = trackTimers();

    await withTimeout(Promise.resolve("sent"), 60_000);

    expect(timers.clearing).toHaveBeenCalledWith(timers.handleFor(60_000));
  });

  it("clears the timer a rejection beat, on the path that leaks the longest", async () => {
    const timers = trackTimers();
    const failing = withTimeout(
      Promise.reject(new Error("network down")),
      50_000,
    );

    await expect(failing).rejects.toThrow("network down");

    expect(timers.clearing).toHaveBeenCalledWith(timers.handleFor(50_000));
  });
});
