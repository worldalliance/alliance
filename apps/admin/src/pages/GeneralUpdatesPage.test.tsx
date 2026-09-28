import type { GeneralUpdateAdminDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import GeneralUpdatesPage from "./GeneralUpdatesPage";

afterEach(cleanup);

const update = (id: number, name: string, startDate?: string) =>
  ({
    id,
    name,
    schemaSnapshotId: id,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    startDate,
    useManualCohort: false,
    priority: 0,
    schema: {},
    tags: [],
  }) satisfies GeneralUpdateAdminDto;

let loadStatus = 200;

serveApi(
  routes({
    "GET /actions/generalUpdates/admin": () =>
      loadStatus === 200
        ? Response.json([
            update(1, "Weekly note", "2026-01-03T00:00:00.000Z"),
            update(2, "Unscheduled note"),
          ])
        : Response.json({}, { status: loadStatus }),
  }),
);

beforeEach(() => {
  loadStatus = 200;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter>
      <GeneralUpdatesPage />
    </MemoryRouter>,
    query,
  );

it("groups the loaded general updates by schedule", async () => {
  renderPage();
  expect(await screen.findByText("Weekly note")).toBeTruthy();
  expect(screen.getByText("Active")).toBeTruthy();
  expect(screen.getByText("Unscheduled note")).toBeTruthy();
  expect(screen.getByText("Draft")).toBeTruthy();
});

it("says the general updates failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(
    await screen.findByText("Failed to load general updates"),
  ).toBeTruthy();
  expect(screen.queryByText("No general updates found.")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded general updates beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Weekly note");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(
    await screen.findByText("Failed to load general updates"),
  ).toBeTruthy();
  expect(screen.getByText("Weekly note")).toBeTruthy();
});
