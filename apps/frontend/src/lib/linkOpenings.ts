import {
  LinkOpeningPlatform,
  trackedArrival,
  type TrackedArrival,
} from "@alliance/common/linkOpening";
import { createLinkOpeningQueue } from "@alliance/shared/lib/linkOpeningQueue";
import { useNotifications } from "@alliance/shared/lib/useNotifications";
import type { PostHog } from "posthog-js";
import { useEffect } from "react";

const STORAGE_KEY = "alliance.linkOpenings";
const SETTLED_EVENT = "linkOpenings:settled";

const linkOpenings = createLinkOpeningQueue({
  platform: LinkOpeningPlatform.Web,
  storage: {
    read: async () => window.localStorage.getItem(STORAGE_KEY),
    write: async (value) => window.localStorage.setItem(STORAGE_KEY, value),
  },
  onSettled: () => window.dispatchEvent(new Event(SETTLED_EVENT)),
});

let arrival: TrackedArrival | null = null;

/**
 * Records the tracked link this page load came through, then takes its
 * tracking parameter out of the address bar, so neither a refresh nor a
 * sign-in redirect sees it again. Call before the router reads the URL.
 */
export async function captureArrival(): Promise<void> {
  arrival = trackedArrival(window.location.href);
  if (!arrival) return;
  await linkOpenings.record(arrival);
  window.history.replaceState(window.history.state, "", arrival.url);
}

/** Hydrates once the arrival is captured, so the router never sees its `cid`. */
export function hydrateAfterCapture(hydrate: () => void): Promise<void> {
  return captureArrival().finally(hydrate);
}

const POSTHOG_WAIT_MS = 5_000;

/**
 * PostHog's `loaded` callback; registering before PostHog loads does nothing.
 * Sending waits for PostHog's first event, which starts its session, so the
 * server's click event joins that session.
 */
export function registerArrival(
  posthog: Pick<
    PostHog,
    "register_for_session" | "on" | "has_opted_out_capturing"
  >,
): void {
  if (arrival) posthog.register_for_session({ cid: arrival.trackingId });
  if (posthog.has_opted_out_capturing()) {
    void linkOpenings.start();
    return;
  }
  const stop = posthog.on("eventCaptured", () => {
    stop();
    void linkOpenings.start();
  });
}

/** With PostHog, sending starts after {@link POSTHOG_WAIT_MS} if PostHog never does. */
export function useLinkOpenings(params: { withPosthog: boolean }): void {
  const { withPosthog } = params;
  useEffect(() => {
    const start = () => void linkOpenings.start();
    const starting = withPosthog ? setTimeout(start, POSTHOG_WAIT_MS) : start();
    const flush = () => void linkOpenings.flush();
    window.addEventListener("online", flush);
    return () => {
      clearTimeout(starting);
      window.removeEventListener("online", flush);
    };
  }, [withPosthog]);
}

/** Recording an opening marks its notification read, so the bell reloads. */
export function RefreshNotificationsOnOpening(): null {
  const { refreshNotifications } = useNotifications();
  useEffect(() => {
    const refresh = () => void refreshNotifications({ limit: 20 });
    window.addEventListener(SETTLED_EVENT, refresh);
    return () => window.removeEventListener(SETTLED_EVENT, refresh);
  }, [refreshNotifications]);
  return null;
}
