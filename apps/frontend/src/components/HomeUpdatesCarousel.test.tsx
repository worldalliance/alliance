import type { ActionUpdateDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import HomeUpdatesCarousel from "./HomeUpdatesCarousel";

const update: ActionUpdateDto = {
  id: 1,
  actionId: 7,
  actionName: "Plant trees",
  title: "Halfway there",
  schemaSnapshotId: 1,
  cardImage: null,
  date: "2026-01-01T00:00:00.000Z",
  visibleAt: "2026-01-01T00:00:00.000Z",
  shortNotifString: "Halfway there",
  associatedEventId: null,
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

const renderRow = () =>
  render(
    <MemoryRouter>
      <HomeUpdatesCarousel />
    </MemoryRouter>,
    { wrapper: queryWrapper().wrapper },
  );

const slideFor = (text: string) =>
  screen.getByText(text).closest<HTMLElement>('[aria-roledescription="slide"]');

it("shows one update at a time and moves between them with the dots", async () => {
  updatesResponse = () =>
    Response.json([update, { ...update, id: 2, title: "All planted" }]);
  renderRow();
  await screen.findByText("Halfway there");
  expect(slideFor("Halfway there")?.inert).toBe(false);
  expect(slideFor("All planted")?.inert).toBe(true);

  expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show update 2 of 2" }));
  expect(slideFor("Halfway there")?.inert).toBe(true);
  expect(slideFor("All planted")?.inert).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Show update 1 of 2" }));
  expect(slideFor("Halfway there")?.inert).toBe(false);
});

it("swipes to the next update and back, ignoring vertical drags", async () => {
  updatesResponse = () =>
    Response.json([update, { ...update, id: 2, title: "All planted" }]);
  renderRow();
  await screen.findByText("Halfway there");
  const viewport = slideFor("Halfway there")!.parentElement!.parentElement!;
  const swipe = (from: [number, number], to: [number, number]) => {
    fireEvent.touchStart(viewport, {
      touches: [{ clientX: from[0], clientY: from[1] }],
    });
    fireEvent.touchEnd(viewport, {
      changedTouches: [{ clientX: to[0], clientY: to[1] }],
    });
  };

  swipe([200, 100], [190, 300]);
  expect(slideFor("Halfway there")?.inert).toBe(false);

  swipe([200, 100], [100, 110]);
  expect(slideFor("All planted")?.inert).toBe(false);

  swipe([100, 100], [200, 90]);
  expect(slideFor("Halfway there")?.inert).toBe(false);
});

it("lists the recent updates", async () => {
  updatesResponse = () => Response.json([update]);
  renderRow();
  expect(await screen.findByText("Halfway there")).toBeTruthy();
});

it("reports a failed load with a retry", async () => {
  updatesResponse = () => Response.json({ message: "down" }, { status: 500 });
  renderRow();
  expect(await screen.findByText("Couldn't load updates.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
