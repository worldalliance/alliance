import { AnalyticsEvent, ExceptionEvent } from "@alliance/common/analytics";
import {
  __resetAnalyticsForTests,
  captureEvent,
  captureException,
  flushAnalytics,
  FlushOutcome,
  registerAnalytics,
  type AnalyticsBackend,
} from "./analytics";

const inertBackend: AnalyticsBackend = {
  capture: () => {},
  captureException: () => {},
};

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("flushAnalytics", () => {
  // These tests register their own backends into the one the module holds, and
  // so do other files in this suite, so without this the no-backend case picks
  // up whatever ran before it.
  beforeEach(__resetAnalyticsForTests);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("says so when a backend can't be flushed, rather than reporting a send", async () => {
    registerAnalytics(inertBackend);

    expect(await flushAnalytics(1000)).toEqual({
      outcome: FlushOutcome.Unsupported,
    });
  });

  it("reports the missing backend when nothing has been registered", async () => {
    expect(await flushAnalytics(1000)).toEqual({
      outcome: FlushOutcome.NoBackend,
    });
  });

  it("waits for the backend's flush", async () => {
    let flushed = false;
    registerAnalytics({
      ...inertBackend,
      flush: async () => {
        await delay(5);
        flushed = true;
      },
    });

    expect(await flushAnalytics(1000)).toEqual({
      outcome: FlushOutcome.Flushed,
    });
    expect(flushed).toBe(true);
  });

  it("gives up at the timeout rather than delaying the caller", async () => {
    let flushed = false;
    let letFlushFinish = () => {};
    const stalled = new Promise<void>((r) => {
      letFlushFinish = r;
    });
    registerAnalytics({
      ...inertBackend,
      flush: async () => {
        await stalled;
        flushed = true;
      },
    });

    expect(await flushAnalytics(20)).toEqual({
      outcome: FlushOutcome.TimedOut,
    });
    expect(flushed).toBe(false);

    letFlushFinish();
  });

  it("hands the caller the cause instead of logging it", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("network down");
    registerAnalytics({ ...inertBackend, flush: () => Promise.reject(error) });

    expect(await flushAnalytics(1000)).toEqual({
      outcome: FlushOutcome.Failed,
      error,
    });
    expect(warning).not.toHaveBeenCalled();
  });

  it("wraps a non-Error rejection, so the caller always gets an Error", async () => {
    registerAnalytics({ ...inertBackend, flush: () => Promise.reject("boom") });

    const result = await flushAnalytics(1000);

    expect(result.outcome).toBe(FlushOutcome.Failed);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("reports a flush that throws before it returns a promise", async () => {
    const error = new Error("no client");
    registerAnalytics({
      ...inertBackend,
      flush: () => {
        throw error;
      },
    });

    expect(await flushAnalytics(1000)).toEqual({
      outcome: FlushOutcome.Failed,
      error,
    });
  });

  it("calls flush on the backend, not detached from it", async () => {
    // posthog's own flush() reads instance state, so calling it off the object
    // would throw, get swallowed, and look like a successful flush.
    const backend = {
      queued: 3,
      capture: () => {},
      captureException: () => {},
      flush() {
        this.queued = 0;
        return Promise.resolve();
      },
    };
    registerAnalytics(backend);

    expect(await flushAnalytics(1000)).toEqual({
      outcome: FlushOutcome.Flushed,
    });
    expect(backend.queued).toBe(0);
  });
});

describe("a backend that throws", () => {
  beforeEach(__resetAnalyticsForTests);
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const throwingBackend: AnalyticsBackend = {
    capture: () => {
      throw new Error("posthog blew up");
    },
    captureException: () => {
      throw new Error("posthog blew up");
    },
  };

  it("does not take captureEvent's caller down with it", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    registerAnalytics(throwingBackend);

    expect(() => captureEvent(AnalyticsEvent.Login)).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not take captureException's caller down with it", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    registerAnalytics(throwingBackend);

    expect(() =>
      captureException(ExceptionEvent.PostReplyError, new Error("boom")),
    ).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("keeps replaying the buffer after one queued call throws", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    captureEvent(AnalyticsEvent.Login);
    captureEvent(AnalyticsEvent.Logout);

    const seen: string[] = [];
    registerAnalytics({
      capture: (event) => {
        seen.push(event);
        if (event === AnalyticsEvent.Login) throw new Error("posthog blew up");
      },
      captureException: () => {},
    });

    expect(seen).toEqual([AnalyticsEvent.Login, AnalyticsEvent.Logout]);
  });
});
