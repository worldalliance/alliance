import type { ActionUpdateDto } from "@alliance/shared/client";
import { makeNotification } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import ActionUpdatesPage from "./ActionUpdatesPage";

const makeUpdate = (id: number, date: string): ActionUpdateDto => ({
  id,
  actionId: 7,
  actionName: "Plant trees",
  actionImage: null,
  title: `Update ${id}`,
  schemaSnapshotId: id,
  cardImage: null,
  date,
  visibleAt: date,
  shortNotifString: `Update ${id}`,
  associatedEventId: null,
  notifyType: "none",
  notifiedAt: null,
  schema: { blocks: [] },
  actionUsersCompleted: 12,
  participantPictures: [],
});

let updatesResponse: () => Response;

serveApi(
  routes({
    "GET /actions/allUpdates": () => updatesResponse(),
    "GET /notifs": () =>
      Response.json([
        makeNotification({ id: 9, contentType: "action_update", contentId: 2 }),
      ]),
  }),
);

const renderPage = () =>
  render(
    <MemoryRouter>
      <ActionUpdatesPage />
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );

it("lists every update as a card, newest first, tagging the newest and unread ones new", async () => {
  updatesResponse = () =>
    Response.json([
      makeUpdate(1, "2026-01-01T00:00:00.000Z"),
      makeUpdate(2, "2026-02-01T00:00:00.000Z"),
      makeUpdate(3, "2026-03-01T00:00:00.000Z"),
    ]);
  renderPage();

  const titles = await screen.findAllByText(/^Update \d$/);
  expect(titles.map((title) => title.textContent)).toEqual([
    "Update 3",
    "Update 2",
    "Update 1",
  ]);
  const card = (title: string) => screen.getByText(title).closest("a");
  expect(card("Update 3")?.getAttribute("href")).toBe("/actions/7");
  expect(card("Update 3")?.textContent).toContain("12 members participated");
  expect(card("Update 3")?.textContent).toContain("New");
  expect(card("Update 2")?.textContent).toContain("New");
  expect(card("Update 1")?.textContent).not.toContain("New");
});

it("reports an unreachable server", async () => {
  updatesResponse = () => {
    throw new TypeError("Failed to fetch");
  };
  renderPage();
  expect(await screen.findByText("Failed to load action updates")).toBeTruthy();
});
