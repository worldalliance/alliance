import type { ActionUpdateDto } from "@alliance/shared/client";
import { makeNotification } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import HomeUpdatesSidebar from "./HomeUpdatesSidebar";

const makeUpdate = (id: number): ActionUpdateDto => ({
  id,
  actionId: 7,
  actionName: "Plant trees",
  actionImage: null,
  title: `Update ${id}`,
  schemaSnapshotId: id,
  cardImage: null,
  date: `2026-01-0${10 - id}T00:00:00.000Z`,
  visibleAt: "2026-01-01T00:00:00.000Z",
  shortNotifString: `Update ${id}`,
  associatedEventId: null,
  notifyType: "none",
  notifiedAt: null,
  schema: { blocks: [] },
});

serveApi(
  routes({
    "GET /actions/updates": () =>
      Response.json([1, 2, 3, 4].map((id) => makeUpdate(id))),
    "GET /notifs": () =>
      Response.json([
        makeNotification({ id: 9, contentType: "action_update", contentId: 2 }),
      ]),
    "GET /notifs/unread-count": () => Response.json({ unreadCount: 1 }),
  }),
);

it("stacks the newest three updates, tagging the newest and unread ones new", async () => {
  render(
    <MemoryRouter>
      <HomeUpdatesSidebar />
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );

  expect(await screen.findByText("Update 1")).toBeTruthy();
  expect(screen.getByText("Update 3")).toBeTruthy();
  expect(screen.queryByText("Update 4")).toBeNull();
  const tagged = (title: string) =>
    screen.getByText(title).closest("a")?.textContent?.includes("New");
  expect(tagged("Update 1")).toBe(true);
  expect(tagged("Update 2")).toBe(true);
  expect(tagged("Update 3")).toBe(false);
});
