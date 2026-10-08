import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { NotificationsProvider } from "@alliance/shared/lib/useNotifications";
import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router";
import {
  captureArrival,
  hydrateAfterCapture,
  RefreshNotificationsOnOpening,
  registerArrival,
  useLinkOpenings,
} from "./linkOpenings";

declare const happyDOM: { setURL: (url: string) => void };

const api = serveApi(
  routes({
    "POST /link-openings": () => new Response(null, { status: 204 }),
  }),
);

afterEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

test("stores the opening, then takes the tracking ID out of the URL", async () => {
  happyDOM.setURL("https://thealliance.org/groups?tab=members&cid=track-1#top");

  await captureArrival();

  expect(window.location.pathname + window.location.search).toBe(
    "/groups?tab=members",
  );
  expect(window.location.hash).toBe("#top");
  expect(
    JSON.parse(window.localStorage.getItem("alliance.linkOpenings") ?? "[]"),
  ).toEqual([
    expect.objectContaining({
      trackingId: "track-1",
      destination: "/groups?tab=members",
      platform: "web",
    }),
  ]);
});

test("leaves an untracked URL alone", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?tab=2");

  await captureArrival();

  expect(window.location.search).toBe("?tab=2");
  expect(window.localStorage.getItem("alliance.linkOpenings")).toBeNull();
});

const fakePosthog = () => {
  const listeners: (() => void)[] = [];
  return {
    register_for_session: jest.fn(),
    has_opted_out_capturing: () => false,
    on: (_event: string, listener: () => void) => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    capture: () => listeners.forEach((listener) => listener()),
  };
};

test("registers the arrival's tracking ID on PostHog's session", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?cid=track-3");
  await captureArrival();
  const posthog = fakePosthog();

  registerArrival(posthog);

  expect(posthog.register_for_session).toHaveBeenCalledWith({
    cid: "track-3",
  });
});

let loads = 0;
// Its own module, so its queue hasn't started.
const freshModule = (): Promise<typeof import("./linkOpenings")> =>
  import(`./linkOpenings?fresh=${loads++}`);

const recordingSends = () => {
  const sent: unknown[] = [];
  api.alsoServing({
    "POST /link-openings": async ({ request }) => {
      sent.push(await request.json());
      return new Response(null, { status: 204 });
    },
  });
  return sent;
};

test("sends nothing until PostHog captures its first event", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?cid=track-4");
  const linkOpenings = await freshModule();
  await linkOpenings.captureArrival();
  const sent = recordingSends();
  const posthog = fakePosthog();
  linkOpenings.registerArrival(posthog);
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(sent).toEqual([]);

  posthog.capture();

  await waitFor(() =>
    expect(sent).toEqual([expect.objectContaining({ trackingId: "track-4" })]),
  );
});

test("starts sending five seconds in when PostHog never captures", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?cid=track-5");
  const linkOpenings = await freshModule();
  await linkOpenings.captureArrival();
  const sent = recordingSends();
  const timers = jest.spyOn(globalThis, "setTimeout");

  renderHook(() => linkOpenings.useLinkOpenings({ withPosthog: true }));
  const fallback = timers.mock.calls.find(([, ms]) => ms === 5_000);
  // testing-library reads a spied setTimeout as fake timers.
  timers.mockRestore();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(sent).toEqual([]);

  const [start] = fallback ?? [];
  if (typeof start !== "function") throw new Error("no fallback timer");
  start();

  await waitFor(() =>
    expect(sent).toContainEqual(
      expect.objectContaining({ trackingId: "track-5" }),
    ),
  );
});

test("sends at once when the visitor opted out of PostHog", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?cid=track-7");
  const linkOpenings = await freshModule();
  await linkOpenings.captureArrival();
  const sent = recordingSends();

  linkOpenings.registerArrival({
    ...fakePosthog(),
    has_opted_out_capturing: () => true,
  });

  await waitFor(() =>
    expect(sent).toContainEqual(
      expect.objectContaining({ trackingId: "track-7" }),
    ),
  );
});

test("sends the opening once started, and again when back online", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?cid=track-2");
  await captureArrival();
  const statuses = [503, 204];
  const sent: unknown[] = [];
  api.alsoServing({
    "POST /link-openings": async ({ request }) => {
      sent.push(await request.json());
      return new Response(null, { status: statuses.shift() });
    },
  });
  const settled = jest.fn();
  window.addEventListener("linkOpenings:settled", settled);

  renderHook(() => useLinkOpenings({ withPosthog: false }));
  await waitFor(() => expect(sent).toHaveLength(1));
  window.dispatchEvent(new Event("online"));
  await waitFor(() => expect(settled).toHaveBeenCalledTimes(1));

  expect(sent).toEqual([
    expect.objectContaining({ trackingId: "track-2" }),
    expect.objectContaining({ trackingId: "track-2" }),
  ]);
  window.removeEventListener("linkOpenings:settled", settled);
});

test("reloads the notifications once an opening is recorded", async () => {
  let notifLoads = 0;
  api.alsoServing({
    "GET /notifs": () => {
      notifLoads++;
      return Response.json([]);
    },
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 0 }),
  });
  const { unmount } = render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        NotificationsProvider,
        null,
        createElement(RefreshNotificationsOnOpening),
      ),
    ),
  );
  await waitFor(() => expect(notifLoads).toBe(1));

  window.dispatchEvent(new Event("linkOpenings:settled"));

  await waitFor(() => expect(notifLoads).toBe(2));
  unmount();
});

test("hydrates once, after the tracking ID is out of the URL", async () => {
  happyDOM.setURL("https://thealliance.org/tasks?cid=track-1");
  const seen: string[] = [];

  await hydrateAfterCapture(() => seen.push(window.location.search));

  expect(seen).toEqual([""]);
});
