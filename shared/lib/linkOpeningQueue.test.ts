import { ExceptionEvent } from "@alliance/common/analytics";
import { LinkOpeningPlatform } from "@alliance/common/linkOpening";
import {
  createLinkOpeningQueue,
  type OpeningStorage,
  pseudoRandomUuid,
  type QueuedOpening,
  sendOpening,
  SendResult,
} from "./linkOpeningQueue";
import { recordExceptions } from "./testing/recordExceptions";
import { routes, serveApi } from "./testing/serveApi";

const arrival = {
  trackingId: "track-1",
  destination: "/tasks",
  url: "https://thealliance.org/tasks",
};

const memoryStorage = (): OpeningStorage & { value: string | null } => {
  const storage = {
    value: null as string | null,
    read: () => Promise.resolve(storage.value),
    write: (value: string) => {
      storage.value = value;
      return Promise.resolve();
    },
  };
  return storage;
};

/** Like AsyncStorage, each read and write settles on a later task. */
const slowStorage = (): OpeningStorage & { value: string | null } => {
  const later = <T>(run: () => T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(run()), 1));
  const storage = {
    value: null as string | null,
    read: () => later(() => storage.value),
    write: (value: string) =>
      later(() => {
        storage.value = value;
      }),
  };
  return storage;
};

const stored = (storage: { value: string | null }): QueuedOpening[] =>
  JSON.parse(storage.value ?? "[]");

describe("createLinkOpeningQueue", () => {
  const exceptions = recordExceptions();
  let now: Date;
  let retries: { run: () => void; delayMs: number }[];
  beforeEach(() => {
    now = new Date("2026-10-06T12:00:00Z");
    retries = [];
  });

  const queueWith = (params: {
    storage: OpeningStorage;
    send: (opening: QueuedOpening) => Promise<SendResult>;
  }) =>
    createLinkOpeningQueue({
      ...params,
      platform: LinkOpeningPlatform.Web,
      now: () => now,
      schedule: (run, delayMs) => retries.push({ run, delayMs }),
    });

  it("stores an opening before sending, and drops it once settled", async () => {
    const storage = memoryStorage();
    const sent: QueuedOpening[] = [];
    let storedWhenSent: QueuedOpening[] = [];
    const queue = queueWith({
      storage,
      send: (opening) => {
        storedWhenSent = stored(storage);
        sent.push(opening);
        return Promise.resolve(SendResult.Settled);
      },
    });

    await queue.record(arrival);
    await queue.start();

    expect(storedWhenSent).toEqual([sent[0]]);
    expect(sent[0]).toMatchObject({
      trackingId: "track-1",
      destination: "/tasks",
      platform: LinkOpeningPlatform.Web,
      observedAt: now.toISOString(),
    });
    expect(stored(storage)).toEqual([]);
  });

  it("retries with the same ID and observation time, after a restart too", async () => {
    const storage = memoryStorage();
    const failing = queueWith({
      storage,
      send: () => Promise.resolve(SendResult.Retry),
    });
    await failing.record(arrival);
    await failing.start();
    const [opening] = stored(storage);

    now = new Date(now.getTime() + 60 * 60_000);
    const sent: QueuedOpening[] = [];
    const restarted = queueWith({
      storage,
      send: (retried) => {
        sent.push(retried);
        return Promise.resolve(SendResult.Settled);
      },
    });
    await restarted.start();

    expect(sent).toEqual([opening]);
    expect(stored(storage)).toEqual([]);
  });

  it("backs off between retries while the app runs", async () => {
    const send = jest.fn(() => Promise.resolve(SendResult.Retry));
    const queue = queueWith({ storage: memoryStorage(), send });
    await queue.record(arrival);
    await queue.start();

    retries.shift()?.run();
    await queue.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(retries.map((retry) => retry.delayMs)).toEqual([4_000]);
  });

  it("starts backing off afresh once nothing is left to retry", async () => {
    let result = SendResult.Retry;
    const queue = queueWith({
      storage: memoryStorage(),
      send: () => Promise.resolve(result),
    });
    await queue.record(arrival);
    await queue.start();
    result = SendResult.Settled;
    retries.shift()?.run();
    await queue.flush();

    result = SendResult.Retry;
    await queue.record(arrival);
    await queue.flush();

    expect(retries.map((retry) => retry.delayMs)).toEqual([2_000]);
  });

  it("caps the delay between retries", async () => {
    const queue = queueWith({
      storage: memoryStorage(),
      send: () => Promise.resolve(SendResult.Retry),
    });
    await queue.record(arrival);
    await queue.start();
    const delays: number[] = [];
    for (let pass = 0; pass < 10; pass++) {
      const retry = retries.shift();
      if (!retry) throw new Error("no retry scheduled");
      delays.push(retry.delayMs);
      retry.run();
      await queue.flush();
    }

    expect(Math.max(...delays)).toBe(300_000);
    expect(delays.slice(-2)).toEqual([300_000, 300_000]);
  });

  it("reports storage it can never read once", async () => {
    const queue = queueWith({
      storage: {
        read: () => Promise.reject(new Error("unavailable")),
        write: () => Promise.resolve(),
      },
      send: () => Promise.resolve(SendResult.Settled),
    });
    await queue.start();
    retries.shift()?.run();
    await queue.flush();

    expect(
      exceptions.filter(
        ({ event }) => event === ExceptionEvent.LinkOpeningsUnreadable,
      ),
    ).toHaveLength(1);
  });

  it("leaves storage alone when a pass removes nothing", async () => {
    const queue = queueWith({
      storage: {
        read: () => Promise.resolve(null),
        write: () => Promise.reject(new Error("full")),
      },
      send: () => Promise.resolve(SendResult.Settled),
    });

    await queue.start();
    await queue.flush();

    expect(exceptions).toEqual([]);
  });

  it("stops retrying a day after the opening", async () => {
    const storage = memoryStorage();
    const queue = queueWith({
      storage,
      send: () => Promise.resolve(SendResult.Retry),
    });
    await queue.record(arrival);
    await queue.start();

    const [opening] = stored(storage);

    now = new Date(now.getTime() + 25 * 60 * 60_000);
    const send = jest.fn(() => Promise.resolve(SendResult.Settled));
    await queueWith({ storage, send }).start();

    expect(send).not.toHaveBeenCalled();
    expect(stored(storage)).toEqual([]);
    expect(exceptions).toEqual([
      {
        event: ExceptionEvent.LinkOpeningExpired,
        error: expect.any(Error),
        properties: { observedAt: opening.observedAt },
      },
    ]);
  });

  it("reports an expired opening it can't remove once", async () => {
    const expired: QueuedOpening = {
      openingId: "expired",
      trackingId: "track-1",
      destination: "/tasks",
      platform: LinkOpeningPlatform.Web,
      observedAt: new Date(now.getTime() - 25 * 60 * 60_000).toISOString(),
    };
    const queue = queueWith({
      storage: {
        read: () => Promise.resolve(JSON.stringify([expired])),
        write: () => Promise.reject(new Error("full")),
      },
      send: () => Promise.resolve(SendResult.Settled),
    });

    await queue.start();
    await queue.flush();

    expect(
      exceptions.filter(
        ({ event }) => event === ExceptionEvent.LinkOpeningExpired,
      ),
    ).toHaveLength(1);
  });

  it("reports an opening that expires while it is being sent", async () => {
    const storage = memoryStorage();
    const queue = queueWith({
      storage,
      send: () => {
        now = new Date(now.getTime() + 25 * 60 * 60_000);
        return Promise.resolve(SendResult.Retry);
      },
    });
    await queue.record(arrival);
    const [opening] = stored(storage);

    await queue.start();
    expect(stored(storage)).toEqual([opening]);
    retries[0].run();
    await queue.flush();

    expect(stored(storage)).toEqual([]);
    expect(exceptions).toEqual([
      {
        event: ExceptionEvent.LinkOpeningExpired,
        error: expect.any(Error),
        properties: { observedAt: opening.observedAt },
      },
    ]);
  });

  it("reports a failed read and retries the stored openings", async () => {
    const storage = memoryStorage();
    const read = storage.read;
    const send = jest.fn(() => Promise.resolve(SendResult.Settled));
    const queue = queueWith({ storage, send });
    await queue.record(arrival);
    storage.read = () => {
      storage.read = read;
      return Promise.reject(new Error("unavailable"));
    };

    await queue.start();
    expect(send).not.toHaveBeenCalled();
    expect(retries).toHaveLength(1);
    retries[0].run();
    await queue.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(stored(storage)).toEqual([]);
    expect(exceptions).toEqual([
      {
        event: ExceptionEvent.LinkOpeningsUnreadable,
        error: new Error("unavailable"),
        properties: {},
      },
    ]);
  });

  it("sends at once when storage fails", async () => {
    const send = jest.fn(() => Promise.resolve(SendResult.Settled));
    const queue = queueWith({
      storage: {
        read: () => Promise.reject(new Error("unavailable")),
        write: () => Promise.reject(new Error("unavailable")),
      },
      send,
    });

    await queue.record(arrival);
    await queue.start();
    await queue.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(exceptions.map(({ event }) => event).sort()).toEqual(
      [
        ExceptionEvent.LinkOpeningNotStored,
        ExceptionEvent.LinkOpeningsUnreadable,
      ].sort(),
    );
  });

  it("reports a pass that settled an opening", async () => {
    let result = SendResult.Retry;
    const onSettled = jest.fn();
    const queue = createLinkOpeningQueue({
      storage: memoryStorage(),
      platform: LinkOpeningPlatform.Web,
      send: () => Promise.resolve(result),
      onSettled,
      schedule: () => {},
    });
    await queue.record(arrival);
    await queue.start();
    expect(onSettled).not.toHaveBeenCalled();

    result = SendResult.Settled;
    await queue.flush();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("sends nothing before it starts", async () => {
    const storage = memoryStorage();
    const send = jest.fn(() => Promise.resolve(SendResult.Settled));
    const queue = queueWith({ storage, send });

    await queue.record(arrival);
    await queue.flush();
    expect(send).not.toHaveBeenCalled();
    expect(stored(storage)).toHaveLength(1);

    await queue.start();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("drops and reports corrupt storage", async () => {
    const storage = memoryStorage();
    storage.value = "{not json";
    const send = jest.fn(() => Promise.resolve(SendResult.Settled));
    const queue = queueWith({ storage, send });

    await queue.start();
    expect(send).not.toHaveBeenCalled();
    expect(storage.value).toBe("[]");
    expect(exceptions).toMatchObject([
      { event: ExceptionEvent.LinkOpeningsUnreadable },
    ]);

    await queue.record(arrival);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the readable openings when one stored entry is unreadable", async () => {
    const storage = memoryStorage();
    const readable: QueuedOpening = {
      openingId: "00000000-0000-4000-8000-000000000001",
      trackingId: "track-1",
      destination: "/tasks",
      platform: LinkOpeningPlatform.Web,
      observedAt: now.toISOString(),
    };
    storage.value = JSON.stringify([
      readable,
      { ...readable, openingId: "b", platform: "desktop" },
    ]);
    const sent: QueuedOpening[] = [];
    const queue = queueWith({
      storage,
      send: (opening) => {
        sent.push(opening);
        return Promise.resolve(SendResult.Retry);
      },
    });

    await queue.start();
    expect(sent).toEqual([readable]);
    expect(stored(storage)).toEqual([readable]);
    expect(exceptions).toMatchObject([
      { event: ExceptionEvent.LinkOpeningsUnreadable },
    ]);
  });

  it("keeps and sends an opening recorded while a pass finishes", async () => {
    const storage = slowStorage();
    const sent: string[] = [];
    let release = () => {};
    const queue = queueWith({
      storage,
      send: async (opening) => {
        sent.push(opening.trackingId);
        if (sent.length === 1) {
          await new Promise<void>((resolve) => (release = resolve));
        }
        return SendResult.Settled;
      },
    });
    await queue.record(arrival);
    const passing = queue.start();
    while (sent.length === 0) await new Promise((r) => setTimeout(r, 1));

    release();
    await queue.record({ ...arrival, trackingId: "track-2" });
    await passing;

    expect(sent).toEqual(["track-1", "track-2"]);
    expect(stored(storage)).toEqual([]);
  });
});

describe("pseudoRandomUuid", () => {
  it("makes version 4 UUIDs", () => {
    for (let i = 0; i < 200; i++) {
      expect(pseudoRandomUuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });
});

describe("sendOpening", () => {
  const api = serveApi(routes({}));
  const exceptions = recordExceptions();
  const opening: QueuedOpening = {
    openingId: "00000000-0000-4000-8000-000000000000",
    trackingId: "track-1",
    destination: "/tasks",
    platform: LinkOpeningPlatform.Web,
    observedAt: "2026-10-06T12:00:00.000Z",
  };

  it.each([
    [204, SendResult.Settled],
    [400, SendResult.Settled],
    [403, SendResult.Settled],
    [404, SendResult.Settled],
    [408, SendResult.Retry],
    [429, SendResult.Retry],
    [500, SendResult.Retry],
    [503, SendResult.Retry],
  ])("treats %i as %s", async (status, result) => {
    api.alsoServing({
      "POST /link-openings": () =>
        status === 204
          ? new Response(null, { status })
          : Response.json({ message: "no" }, { status }),
    });
    expect(await sendOpening(opening)).toBe(result);
  });

  it("reports a refused opening, but not an unknown tracking ID", async () => {
    for (const status of [400, 403, 404]) {
      api.alsoServing({
        "POST /link-openings": () =>
          Response.json({ message: `refused ${status}` }, { status }),
      });
      await sendOpening(opening);
    }

    expect(exceptions).toEqual([
      {
        event: ExceptionEvent.LinkOpeningRefused,
        error: expect.objectContaining({ message: "refused 400" }),
        properties: { status: 400 },
      },
      {
        event: ExceptionEvent.LinkOpeningRefused,
        error: expect.objectContaining({ message: "refused 403" }),
        properties: { status: 403 },
      },
    ]);
  });

  it("retries a request that doesn't answer in time", async () => {
    api.alsoServing({ "POST /link-openings": () => new Promise(() => {}) });
    expect(await sendOpening(opening, 10)).toBe(SendResult.Retry);
  });

  it("retries when the request fails", async () => {
    api.alsoServing({
      "POST /link-openings": () => Promise.reject(new TypeError("offline")),
    });
    expect(await sendOpening(opening)).toBe(SendResult.Retry);
  });
});
