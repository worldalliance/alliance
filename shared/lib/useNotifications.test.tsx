import { NOTIFS_LOADED_AT_HEADER } from "@alliance/common/notifs";
import { NotificationDto } from "@alliance/shared/client";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { routes, serveApi } from "./testing/serveApi";
import { NotificationsProvider, useNotifications } from "./useNotifications";

const LOADED_AT = "2026-09-23T12:00:00.123Z";
const LATER = "2026-09-23T12:05:00.000Z";

let loadedAtHeader: string | null = LOADED_AT;
let unreadCount = 1;
const listQueries: URLSearchParams[] = [];
const readAllQueries: URLSearchParams[] = [];

const notification: NotificationDto = {
  id: 1,
  category: "action_event",
  message: "A reminder",
  priority: "low",
  webAppLocation: "/",
  mobileAppLocation: null,
  readAt: null,
  createdAt: LOADED_AT,
  updatedAt: LOADED_AT,
  sendTime: LOADED_AT,
  associatedUsers: [],
  sourceType: "notification",
};

const dueLater: NotificationDto = {
  ...notification,
  id: 2,
  createdAt: LATER,
  updatedAt: LATER,
  sendTime: LATER,
};

let listed = [notification];
let wholeListServed = Promise.resolve();
let failingListLoads = 0;

serveApi(
  routes({
    "GET /notifs": async ({ request }) => {
      const query = new URL(request.url).searchParams;
      listQueries.push(query);
      if (failingListLoads > 0) {
        failingListLoads--;
        return new Response(null, { status: 500 });
      }
      if (!query.has("limit")) await wholeListServed;
      return Response.json(listed, {
        headers: loadedAtHeader
          ? { [NOTIFS_LOADED_AT_HEADER]: loadedAtHeader }
          : {},
      });
    },
    "GET /notifs/unread-count": () => Response.json({ unreadCount }),
    "POST /notifs/read-all": ({ request }) => {
      readAllQueries.push(new URL(request.url).searchParams);
      return new Response(null, { status: 201 });
    },
  }),
);

afterEach(() => {
  loadedAtHeader = LOADED_AT;
  unreadCount = 1;
  listed = [notification];
  wholeListServed = Promise.resolve();
  failingListLoads = 0;
  listQueries.length = 0;
  readAllQueries.length = 0;
  cleanup();
});

const MarkAll = () => {
  const {
    notifications,
    unreadCount,
    handleMarkAllAsRead,
    refreshNotifications,
  } = useNotifications();
  return (
    <>
      <button onClick={handleMarkAllAsRead}>
        {notifications.length} loaded
      </button>
      <button onClick={() => refreshNotifications()}>Load all</button>
      <button onClick={() => refreshNotifications({ limit: 20 })}>
        Load 20
      </button>
      <output>{unreadCount} unread</output>
    </>
  );
};

const WholeListPage = () => {
  const { refreshNotifications } = useNotifications();
  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);
  return <MarkAll />;
};

const renderMarkAll = (Page = MarkAll) =>
  render(
    <MemoryRouter>
      <NotificationsProvider>
        <Page />
      </NotificationsProvider>
    </MemoryRouter>,
  );

const markAllAfterLoad = async () => {
  renderMarkAll();
  fireEvent.click(await screen.findByRole("button", { name: "1 loaded" }));
  await waitFor(() => expect(readAllQueries).toHaveLength(1));
  return readAllQueries[0];
};

it("marks all read up to the list's load time", async () => {
  const query = await markAllAfterLoad();
  expect(query.get("loadedAt")).toBe(LOADED_AT);
});

it("marks all read with no bound when the list came without a load time", async () => {
  loadedAtHeader = null;
  const query = await markAllAfterLoad();
  expect(query.has("loadedAt")).toBe(false);
});

it("shows the server's unread count after marking all read", async () => {
  await markAllAfterLoad();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("1 unread"),
  );
});

it("lists a row that came due after the load, and bounds the next mark-all by the new load", async () => {
  renderMarkAll();
  const markAll = await screen.findByRole("button", { name: "1 loaded" });
  listed = [notification, dueLater];
  loadedAtHeader = LATER;
  fireEvent.click(markAll);
  fireEvent.click(await screen.findByRole("button", { name: "2 loaded" }));
  await waitFor(() => expect(readAllQueries).toHaveLength(2));
  expect(readAllQueries[1].get("loadedAt")).toBe(LATER);
});

it("refetches the whole list after marking all read from the whole list", async () => {
  renderMarkAll();
  await screen.findByRole("button", { name: "1 loaded" });
  fireEvent.click(screen.getByRole("button", { name: "Load all" }));
  await waitFor(() => expect(listQueries).toHaveLength(2));
  fireEvent.click(screen.getByRole("button", { name: "1 loaded" }));
  await waitFor(() => expect(listQueries).toHaveLength(3));
  expect(listQueries[2].has("limit")).toBe(false);
});

it("refetches the dropdown's page after marking all read when it reloaded over the whole list", async () => {
  renderMarkAll();
  await screen.findByRole("button", { name: "1 loaded" });
  listed = [notification, dueLater];
  fireEvent.click(screen.getByRole("button", { name: "Load all" }));
  await screen.findByRole("button", { name: "2 loaded" });
  listed = [notification];
  fireEvent.click(screen.getByRole("button", { name: "Load 20" }));
  fireEvent.click(await screen.findByRole("button", { name: "1 loaded" }));
  await waitFor(() => expect(listQueries).toHaveLength(4));
  expect(listQueries[3].get("limit")).toBe("20");
});

it("refetches the whole list after marking all read from a page that loaded it alongside the provider's first load", async () => {
  const wholeList = Promise.withResolvers<void>();
  wholeListServed = wholeList.promise;
  renderMarkAll(WholeListPage);
  await screen.findByRole("button", { name: "1 loaded" });
  listed = [notification, dueLater];
  wholeList.resolve();
  fireEvent.click(await screen.findByRole("button", { name: "2 loaded" }));
  await waitFor(() => expect(listQueries).toHaveLength(3));
  expect(listQueries[2].has("limit")).toBe(false);
});

it("marks all read up to the whole list's load time", async () => {
  renderMarkAll();
  await screen.findByRole("button", { name: "1 loaded" });
  listed = [notification, dueLater];
  loadedAtHeader = LATER;
  fireEvent.click(screen.getByRole("button", { name: "Load all" }));
  fireEvent.click(await screen.findByRole("button", { name: "2 loaded" }));
  await waitFor(() => expect(readAllQueries).toHaveLength(1));
  expect(readAllQueries[0].get("loadedAt")).toBe(LATER);
});

it("refetches the dropdown's page after marking all read from it", async () => {
  await markAllAfterLoad();
  await waitFor(() => expect(listQueries).toHaveLength(2));
  expect(listQueries[1].get("limit")).toBe("20");
});

it("refetches the dropdown's page after marking all read when the first load failed", async () => {
  failingListLoads = 1;
  renderMarkAll();
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe("1 unread"),
  );
  fireEvent.click(screen.getByRole("button", { name: "0 loaded" }));
  await waitFor(() => expect(listQueries).toHaveLength(2));
  expect(listQueries[1].get("limit")).toBe("20");
});
