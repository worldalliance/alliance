import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { NotificationsProvider } from "@alliance/shared/lib/useNotifications";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  ScrollRestoration,
} from "react-router";
import { useCIDFromParams } from "./utils";

let clicks: number;

serveApi(
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
