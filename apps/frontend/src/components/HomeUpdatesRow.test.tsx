import type { ActionUpdateDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { NotificationsProvider } from "@alliance/shared/lib/useNotifications";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import HomeUpdatesRow from "./HomeUpdatesRow";

const update: ActionUpdateDto = {
  id: 1,
  actionId: 7,
  actionName: "Plant trees",
  title: "Halfway there",
  schemaSnapshotId: 1,
  date: "2026-01-01T00:00:00.000Z",
  visibleAt: "2026-01-01T00:00:00.000Z",
  shortNotifString: "Halfway there",
  notifyType: "none",
  notifiedAt: null,
  schema: {},
};

let updatesResponse: () => Response;

serveApi(
  routes({
    "GET /actions/updates": () => updatesResponse(),
    "GET /notifs": () => Response.json([]),
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 0 }),
  }),
);

afterEach(cleanup);

const renderRow = () =>
  render(
    <MemoryRouter>
      <NotificationsProvider>
        <HomeUpdatesRow />
      </NotificationsProvider>
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );

it("lists the recent updates", async () => {
  updatesResponse = () => Response.json([update]);
  renderRow();
  expect(await screen.findByText("Halfway there")).toBeTruthy();
});

it("reports a failed load", async () => {
  updatesResponse = () => Response.json({ message: "down" }, { status: 500 });
  renderRow();
  expect(await screen.findByText("Could not load updates.")).toBeTruthy();
});
