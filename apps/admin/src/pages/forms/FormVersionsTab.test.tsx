import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import { FormVersionsTab } from "./FormVersionsTab";

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
});

const renderTab = (state?: unknown) =>
  render(
    <MemoryRouter
      initialEntries={[
        { pathname: "/tasks/forms/4", search: "?tab=versions", state },
      ]}
    >
      <ToastProvider>
        <Routes>
          <Route
            path="/tasks/forms/:formId"
            element={<FormVersionsTab formId={4} />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const selectAll = () =>
  screen.findByRole("checkbox", {
    name: "Select all 1 response on v7",
  });

const reassignSelected = async () => {
  fireEvent.click(await selectAll());
  fireEvent.click(
    screen.getByRole("button", { name: "Reassign to current version…" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Reassign 1 response",
    }),
  );
};

it("reassigns the selected responses to the current version and reloads", async () => {
  renderTab();
  await reassignSelected();

  expect(await screen.findByText("Reassigned 1 response.")).toBeTruthy();
  expect(migratedBodies).toEqual([{ responseIds: [11], targetSnapshotId: 9 }]);
  await waitFor(() => expect(loads).toBe(2));
  expect(screen.getByText("0 selected")).toBeTruthy();
});

it("says so when a reassignment is refused, keeping the versions and reloading them", async () => {
  migrateStatus = 409;
  renderTab();
  await reassignSelected();

  expect(
    await screen.findByText(/^Couldn't reassign the responses/),
  ).toBeTruthy();
  expect(screen.queryByText(/^Reassigned/)).toBeNull();
  expect(await selectAll()).toBeTruthy();
  await waitFor(() => expect(loads).toBe(2));
});

it("says so when the versions fail to load", async () => {
  loadStatus = 500;
  renderTab();

  expect(await screen.findByText("Couldn't load versions")).toBeTruthy();
});

it("leads back to the responses view it came from", async () => {
  renderTab({ returnTo: "/tasks/12?tab=responses&resp.q=ada" });

  const back = await screen.findByRole("link", { name: "Back to responses" });
  expect(back.getAttribute("href")).toBe("/tasks/12?tab=responses&resp.q=ada");
});

it("offers no way back when it was opened directly", async () => {
  renderTab();

  await selectAll();
  expect(screen.queryByRole("link", { name: "Back to responses" })).toBeNull();
});
