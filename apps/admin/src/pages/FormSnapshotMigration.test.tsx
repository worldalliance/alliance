import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import FormSnapshotMigration from "./FormSnapshotMigration";

afterEach(cleanup);

const snapshot = (id: number) => ({
  id,
  hash: `hash-${id}`,
  createdAt: "2026-01-01T00:00:00.000Z",
  schema: { pages: [], outputViews: [] },
});

let loads = 0;
let loadStatus = 200;
let migrateStatus = 200;
let migratedBodies: unknown[] = [];

serveApi(
  routes({
    "GET /tasks/forms/:formId/snapshotMigration": () => {
      loads += 1;
      if (loadStatus !== 200) return Response.json({}, { status: loadStatus });
      return Response.json({
        formTitle: "Survey",
        latestSnapshot: snapshot(9),
        groups: [
          {
            snapshot: snapshot(7),
            responses: [
              {
                id: 11,
                createdAt: "2026-01-02T00:00:00.000Z",
                userName: "Ada",
              },
            ],
          },
        ],
      });
    },
    "PATCH /tasks/forms/:formId/responseSnapshots": async ({ request }) => {
      migratedBodies.push(await request.json());
      if (migrateStatus !== 200) {
        return Response.json({}, { status: migrateStatus });
      }
      return Response.json({ updatedCount: 1 });
    },
  }),
);

beforeEach(() => {
  loads = 0;
  loadStatus = 200;
  migrateStatus = 200;
  migratedBodies = [];
  jest.spyOn(window, "confirm").mockReturnValue(true);
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/forms/4/snapshots"]}>
      <Routes>
        <Route
          path="/forms/:formId/snapshots"
          element={<FormSnapshotMigration />}
        />
      </Routes>
    </MemoryRouter>,
    queryWrapper(),
  );

const reassignSelected = async () => {
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Reassign 1 selected" }));
};

it("reassigns the selected responses to the current snapshot and reloads", async () => {
  renderPage();
  await reassignSelected();

  expect(await screen.findByText("Reassigned 1 response.")).toBeTruthy();
  expect(migratedBodies).toEqual([{ responseIds: [11], targetSnapshotId: 9 }]);
  expect(loads).toBe(2);
  expect(
    screen.getByText("0 of 1 responses selected", { exact: false }),
  ).toBeTruthy();
});

it("says so when a reassignment is refused, keeping the groups and reloading them", async () => {
  migrateStatus = 409;
  renderPage();
  await reassignSelected();

  expect(await screen.findByText("Failed to reassign snapshots")).toBeTruthy();
  expect(screen.queryByText(/^Reassigned/)).toBeNull();
  expect(screen.getByRole("checkbox")).toBeTruthy();
  expect(loads).toBe(2);
});

it("says so when the snapshots fail to load", async () => {
  loadStatus = 500;
  renderPage();

  expect(
    await screen.findByText("Failed to load snapshot migration data"),
  ).toBeTruthy();
});
