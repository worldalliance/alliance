import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { NotificationsProvider } from "@alliance/shared/lib/useNotifications";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  ScrollRestoration,
} from "react-router";
import { useCIDFromParams } from "./utils";

let clicks: number;

const api = serveApi(
  routes({
    "POST /notifs/linkClick": () => {
      clicks++;
      return Response.json({ mms: false });
    },
    "GET /notifs": () => Response.json([]),
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 0 }),
  }),
);

let router: ReturnType<typeof createMemoryRouter>;
const resetsAt: string[] = [];
const realScrollTo = window.scrollTo;
window.scrollTo = () => {
  resetsAt.push(router.state.location.search);
};

afterEach(cleanup);

afterAll(() => {
  window.scrollTo = realScrollTo;
});

const Page = () => {
  useCIDFromParams();
  return null;
};

const Layout = () => (
  <NotificationsProvider>
    <ScrollRestoration />
    <Outlet />
  </NotificationsProvider>
);

test("strips cid in place, without a scroll reset or a history entry", async () => {
  clicks = 0;
  router = createMemoryRouter(
    [{ element: <Layout />, children: [{ path: "/home", element: <Page /> }] }],
    { initialEntries: ["/elsewhere", "/home?cid=abc"], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);

  await waitFor(() => expect(router.state.location.search).toBe(""));

  // ScrollRestoration resets once on mount, while cid is still there.
  expect(resetsAt).toEqual(["?cid=abc"]);
  expect(router.state.historyAction).toBe("REPLACE");
  expect(clicks).toBe(1);
});

test("leaves the next page's URL alone when the click lands after leaving", async () => {
  clicks = 0;
  let notifLoads = 0;
  const held = Promise.withResolvers<void>();
  api.alsoServing({
    "POST /notifs/linkClick": async () => {
      clicks++;
      await held.promise;
      return Response.json({ mms: false });
    },
    "GET /notifs": () => {
      notifLoads++;
      return Response.json([]);
    },
  });
  router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: "/actions/1", element: <Page /> },
          { path: "/other", element: <p>other page</p> },
        ],
      },
    ],
    { initialEntries: ["/actions/1?cid=abc&sid=s1"] },
  );
  render(<RouterProvider router={router} />);
  await waitFor(() => expect([clicks, notifLoads]).toEqual([1, 1]));
  await router.navigate("/other?tab=2");
  await screen.findByText("other page");

  held.resolve();
  await waitFor(() => expect(notifLoads).toBe(2));

  expect(router.state.location.pathname + router.state.location.search).toBe(
    "/other?tab=2",
  );
});
