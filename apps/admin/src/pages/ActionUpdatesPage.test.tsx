import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import ActionUpdatesPage from "./ActionUpdatesPage";

const update = (id: number, title: string, visibleAt: string | null) => ({
  id,
  actionId: 4,
  actionName: "Call your senator",
  title,
  date: "2026-10-20T17:00:00.000Z",
  visibleAt,
  notifyType: "none",
  notifiedAt: null,
  shortNotifString: "",
  associatedEventId: null,
  schemaSnapshotId: 1,
  schema: { blocks: [] },
});

serveApi(
  routes({
    "GET /actions/updates/admin": () =>
      Response.json([
        update(1, "Still writing", null),
        update(2, "Goes out Monday", "2099-01-05T17:00:00.000Z"),
        update(3, "Already out", "2026-10-20T17:00:00.000Z"),
      ]),
  }),
);

it("groups every update into drafts, scheduled, and published", async () => {
  render(
    <MemoryRouter>
      <ActionUpdatesPage />
    </MemoryRouter>,
    queryWrapper(),
  );

  expect(await screen.findByText("Draft · 1 update")).toBeTruthy();
  expect(screen.getByText("Scheduled · 1 update")).toBeTruthy();
  expect(screen.getByText("Published · 1 update")).toBeTruthy();
  expect(screen.getByText(/^Publishes /)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Still writing" }).getAttribute("href"),
  ).toBe("/actions/4/updates/1");
});
