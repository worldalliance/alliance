import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import ProjectUpdatesPage from "./ProjectUpdatesPage";

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

let loadStatus = 200;

serveApi(
  routes({
    "GET /actions/updates/admin": () =>
      loadStatus === 200
        ? Response.json([
            update(1, "Still writing", null),
            update(2, "Goes out Monday", "2099-01-05T17:00:00.000Z"),
            update(3, "Already out", "2026-10-20T17:00:00.000Z"),
          ])
        : Response.json({}, { status: loadStatus }),
  }),
);

afterEach(() => {
  loadStatus = 200;
});

const renderPage = (url = "/content/project-updates") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ProjectUpdatesPage />
    </MemoryRouter>,
    queryWrapper(),
  );

const groupOf = (status: string) => {
  const heading = screen.getByText(status).closest("tr");
  if (!heading) throw new Error(`no ${status} group`);
  return heading;
};

it("groups every update into drafts, scheduled, and published", async () => {
  renderPage();

  expect(await screen.findByText("Still writing")).toBeTruthy();
  expect(within(groupOf("Draft")).getByText("1")).toBeTruthy();
  expect(within(groupOf("Scheduled")).getByText("1")).toBeTruthy();
  expect(within(groupOf("Published")).getByText("1")).toBeTruthy();
  const scheduled = screen.getByText("Goes out Monday").closest("tr");
  if (!scheduled) throw new Error("no scheduled row");
  expect(
    within(scheduled).getByText(
      formatDateTime("2099-01-05T17:00:00.000Z", {
        timeZone: LAUNCH_TIME_ZONE,
      }),
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Still writing" }).getAttribute("href"),
  ).toBe("/tasks/4/updates/1");
});

it("filters by the update's title or its task's name", async () => {
  renderPage("/content/project-updates?q=monday");

  expect(await screen.findByText("Goes out Monday")).toBeTruthy();
  expect(screen.queryByText("Still writing")).toBeNull();
  expect(screen.getByText("1 of 3 updates")).toBeTruthy();
});

it("says the updates failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();

  expect(await screen.findByText("Couldn't load project updates")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No project updates yet")).toBeNull();
});
