import {
  LinkOpeningPlatform,
  trackedArrival,
  type TrackedArrival,
} from "@alliance/common/linkOpening";
import { withTimeout } from "@alliance/common/timeout";
import {
  createLinkOpeningQueue,
  type LinkOpeningQueue,
  type OpeningStorage,
} from "@alliance/shared/lib/linkOpeningQueue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { milliseconds } from "date-fns";
import type { PostHog } from "posthog-react-native";
import type { AppStateStatic } from "react-native";
import { queryClient } from "./queryClient";
import { notificationsCache } from "./useNotificationsCache";

const STORAGE_KEY = "alliance.linkOpenings";
const LAST_INITIAL_KEY = "alliance.lastInitialLink";

export const linkOpenings = createLinkOpeningQueue({
  platform: LinkOpeningPlatform.Mobile,
  storage: {
    read: () => AsyncStorage.getItem(STORAGE_KEY),
    write: (value) => AsyncStorage.setItem(STORAGE_KEY, value),
  },
  // Recording an opening marks its notification read.
  onSettled: () => void notificationsCache(queryClient).refresh(),
});

const POSTHOG_WAIT_MS = milliseconds({ seconds: 5 });

/**
 * Renews PostHog's session for each arrival, so a send's session header names
 * the session the app's next events join, and the server's click event with it.
 */
export function createLinkOpeningSession() {
  let posthog: Pick<PostHog, "getSessionId" | "optedOut"> | null = null;
  let markReady = () => {};
  const ready = new Promise<void>((resolve) => (markReady = resolve));
  const renew = () => {
    if (posthog && !posthog.optedOut) posthog.getSessionId();
  };
  return {
    ready,
    renew,
    /** Call once PostHog is ready. */
    register: (instance: Pick<PostHog, "getSessionId" | "optedOut">) => {
      posthog = instance;
      renew();
      markReady();
    },
  };
}

export const linkOpeningSession = createLinkOpeningSession();

/**
 * Starts sending once the API client is configured and PostHog is ready, or
 * after {@link POSTHOG_WAIT_MS} if PostHog never is, and sends again whenever
 * the app returns to the foreground.
 */
export function startLinkOpenings(params: {
  appState: Pick<AppStateStatic, "addEventListener">;
  posthogReady: Promise<void>;
}): () => void {
  const { appState, posthogReady } = params;
  const start = () => void linkOpenings.start();
  const starting = setTimeout(start, POSTHOG_WAIT_MS);
  void posthogReady.then(() => {
    clearTimeout(starting);
    start();
  });
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "active") void linkOpenings.flush();
  });
  return () => {
    clearTimeout(starting);
    subscription.remove();
  };
}

// iOS can deliver a cold-start link both as the initial URL and as a URL event.
const REDELIVERY_MS = milliseconds({ seconds: 2 });
// Routing waits this long at most for the opening to be stored, so a stalled
// storage never holds up the link.
const RECORD_WAIT_MS = 500;

/**
 * Records an incoming tracked link once, and returns the URL to route to
 * without its tracking parameter.
 */
export function createArrivalCapture(params: {
  queue: Pick<LinkOpeningQueue, "record">;
  lastInitial: OpeningStorage;
  now: () => number;
  renewSession: () => void;
}) {
  const { queue, lastInitial, now, renewSession } = params;
  let last: { url: string; at: number } | null = null;

  // An OTA update's reload reads the initial URL again, and Android replays
  // it whenever it rebuilds a killed app reopened from recents, at any time
  // after, so a second cold start through the same link goes uncounted.
  const replayed = async (arrival: TrackedArrival): Promise<boolean> => {
    const key = `${arrival.trackingId} ${arrival.destination}`;
    if ((await lastInitial.read().catch(() => null)) === key) return true;
    await lastInitial.write(key).catch(() => {});
    return false;
  };

  // Synchronous for an untracked URL, so Expo Router can resolve the initial
  // route on the first render.
  return (delivery: {
    url: string;
    initial: boolean;
  }): string | Promise<string> => {
    const { url, initial } = delivery;
    const arrival = trackedArrival(url);
    if (!arrival) return url;
    const at = now();
    const redelivered = last?.url === url && at - last.at < REDELIVERY_MS;
    last = { url, at };
    if (redelivered) return arrival.url;
    const record = async () => {
      if (initial && (await replayed(arrival))) return;
      renewSession();
      await queue.record(arrival);
    };
    return withTimeout(record(), RECORD_WAIT_MS).then(() => arrival.url);
  };
}

export const captureArrival = createArrivalCapture({
  queue: linkOpenings,
  lastInitial: {
    read: () => AsyncStorage.getItem(LAST_INITIAL_KEY),
    write: (value) => AsyncStorage.setItem(LAST_INITIAL_KEY, value),
  },
  now: Date.now,
  renewSession: linkOpeningSession.renew,
});
