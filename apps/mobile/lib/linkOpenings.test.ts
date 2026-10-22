import {
  LINK_OPENING_DEADLINE_MS,
  trackedArrival,
  type TrackedArrival,
} from "@alliance/common/linkOpening";
import { TIMED_OUT, withTimeout } from "@alliance/common/timeout";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppStateStatus } from "react-native";
import {
  createArrivalCapture,
  createLinkOpeningSession,
  linkOpenings,
  startLinkOpenings,
} from "./linkOpenings";
import { memoryAsyncStorage } from "./memoryAsyncStorage";
import { queryClient } from "./queryClient";

const api = serveApi(
  routes({
    "POST /link-openings": () => new Response(null, { status: 204 }),
  }),
);

beforeEach(memoryAsyncStorage);
afterEach(() => jest.restoreAllMocks());

const memoryStorage = () => {
  let value: string | null = null;
  return {
    read: async () => value,
    write: async (next: string) => {
      value = next;
    },
  };
};

const setup = (lastInitial = memoryStorage()) => {
  let now = 0;
  const recorded: TrackedArrival[] = [];
  const renewals: number[] = [];
  const capture = createArrivalCapture({
    queue: {
      record: (arrival) => {
        recorded.push(arrival);
        return Promise.resolve();
      },
    },
    lastInitial,
    now: () => now,
    renewSession: () => renewals.push(recorded.length),
  });
  return { capture, recorded, renewals, advance: (ms: number) => (now += ms) };
};

test("records a tracked link and routes without its tracking ID", async () => {
  const { capture, recorded } = setup();

  expect(
    await capture({
      url: "https://thealliance.org/actions/7?cid=track-1",
      initial: false,
    }),
  ).toBe("https://thealliance.org/actions/7");
  expect(recorded).toEqual([
    expect.objectContaining({
      trackingId: "track-1",
      destination: "/actions/7",
    }),
  ]);
});

test("renews the PostHog session before recording an arrival", async () => {
  const { capture, renewals } = setup();

  await capture({ url: "alliance://tasks?cid=track-1", initial: false });
  capture({ url: "alliance://tasks", initial: false });

  expect(renewals).toEqual([0]);
});

test("renews the session of a PostHog that isn't opted out, once registered", async () => {
  const session = createLinkOpeningSession();
  const posthog = { getSessionId: jest.fn(() => "session"), optedOut: false };

  session.renew();
  session.register(posthog);
  await session.ready;
  session.renew();
  posthog.optedOut = true;
  session.renew();

  expect(posthog.getSessionId).toHaveBeenCalledTimes(2);
});

test("records a link delivered twice at once only once", async () => {
  const { capture, recorded, advance } = setup();
  const url = "alliance://tasks?cid=track-1";

  await capture({ url, initial: false });
  advance(100);
  await capture({ url, initial: false });
  expect(recorded).toHaveLength(1);

  advance(5_000);
  await capture({ url, initial: false });
  expect(recorded).toHaveLength(2);
});

test("records a cold-start link once however often it comes again", async () => {
  const lastInitial = memoryStorage();
  const url = "alliance://tasks?cid=track-1";
  const before = setup(lastInitial);
  await before.capture({ url, initial: true });

  const after = setup(lastInitial);
  await after.capture({ url, initial: true });
  after.advance(LINK_OPENING_DEADLINE_MS * 2);
  await after.capture({ url, initial: true });
  await after.capture({ url: "alliance://tasks?cid=track-9", initial: true });

  expect(before.recorded).toHaveLength(1);
  expect(after.recorded).toEqual([
    expect.objectContaining({ trackingId: "track-9" }),
  ]);
});

test("keeps a cold-start link's other parameters off disk", async () => {
  const lastInitial = memoryStorage();
  const { capture } = setup(lastInitial);

  await capture({
    url: "alliance://join?cid=track-1&code=private-token",
    initial: true,
  });

  expect(await lastInitial.read()).not.toContain("private-token");
});

test("routes a tracked link even when storing it stalls", async () => {
  const capture = createArrivalCapture({
    queue: { record: () => new Promise(() => {}) },
    lastInitial: memoryStorage(),
    now: () => 0,
    renewSession: () => {},
  });

  expect(
    await capture({ url: "alliance://tasks?cid=track-1", initial: false }),
  ).toBe("alliance://tasks");
});

test("passes an untracked link through synchronously", () => {
  const { capture, recorded } = setup();

  expect(capture({ url: "alliance://settings", initial: false })).toBe(
    "alliance://settings",
  );
  expect(recorded).toEqual([]);
});

test("stores a recorded opening before sending it", async () => {
  const arrival = trackedArrival("alliance://tasks?cid=track-3");
  if (!arrival) throw new Error("untracked");

  await linkOpenings.record(arrival);

  expect(
    JSON.parse((await AsyncStorage.getItem("alliance.linkOpenings")) ?? "[]"),
  ).toContainEqual(expect.objectContaining({ trackingId: "track-3" }));
});

test("reloads the notifications once an opening is recorded", async () => {
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const arrival = trackedArrival("alliance://tasks?cid=track-1");
  if (!arrival) throw new Error("untracked");

  await linkOpenings.record(arrival);
  await linkOpenings.start();

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: queryKeys.notifications(),
  });
  invalidate.mockRestore();
});

test("sends again when the app returns to the foreground", async () => {
  const statuses = [503, 204];
  const sent: unknown[] = [];
  api.alsoServing({
    "POST /link-openings": async ({ request }) => {
      sent.push(await request.json());
      return new Response(null, { status: statuses.shift() });
    },
  });
  const sends = (count: number) =>
    new Promise<void>((resolve) => {
      const check = () =>
        sent.length >= count ? resolve() : setTimeout(check, 5);
      check();
    });
  let onChange: (state: AppStateStatus) => void = () => {};
  const arrival = trackedArrival("alliance://tasks?cid=track-2");
  if (!arrival) throw new Error("untracked");
  await linkOpenings.record(arrival);

  const stop = startLinkOpenings({
    appState: {
      addEventListener: (_type, listener) => {
        onChange = listener;
        return { remove: () => {} };
      },
    },
    posthogReady: Promise.resolve(),
  });
  await sends(1);
  onChange("active");
  // Sooner than the queue's own retry of the refused send.
  expect(await withTimeout(sends(2), 1_000)).not.toBe(TIMED_OUT);
  stop();

  expect(sent).toEqual([
    expect.objectContaining({ trackingId: "track-2" }),
    expect.objectContaining({ trackingId: "track-2" }),
  ]);
});

test("starts sending once PostHog is ready", async () => {
  const start = jest.spyOn(linkOpenings, "start");
  const session = createLinkOpeningSession();

  const stop = startLinkOpenings({
    appState: { addEventListener: () => ({ remove: () => {} }) },
    posthogReady: session.ready,
  });
  await Promise.resolve();
  const before = start.mock.calls.length;
  session.register({ getSessionId: () => "session", optedOut: true });
  await session.ready;
  await Promise.resolve();
  stop();

  expect(before).toBe(0);
  expect(start).toHaveBeenCalledTimes(1);
});

test("starts sending after a while if PostHog is never ready", () => {
  jest.useFakeTimers();
  const start = jest.spyOn(linkOpenings, "start");

  const stop = startLinkOpenings({
    appState: { addEventListener: () => ({ remove: () => {} }) },
    posthogReady: new Promise(() => {}),
  });
  jest.advanceTimersByTime(4_999);
  const before = start.mock.calls.length;
  jest.advanceTimersByTime(1);
  stop();
  jest.useRealTimers();

  expect(before).toBe(0);
  expect(start).toHaveBeenCalledTimes(1);
});
