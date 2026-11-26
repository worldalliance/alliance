import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, setSystemTime } from "bun:test";
import { MemoryRouter } from "react-router";
import SnapshotNavigator from "./SnapshotNavigator";

let requested: string[] = [];
let status = 200;

serveApi(
  routes({
    "GET /tasks/forms/:formId/snapshotMigration": ({ params }) => {
      requested.push(params.formId);
      if (status !== 200) return Response.json({}, { status });
      return Response.json({
        formTitle: "Survey",
        latestSnapshot: {
          id: 9,
          hash: "hash-9",
          createdAt: "2026-03-15T12:00:00.000Z",
          schema: { pages: [], outputViews: [] },
        },
        groups: [],
      });
    },
  }),
);

beforeEach(() => {
  setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
  requested = [];
  status = 200;
});

afterEach(() => setSystemTime());

const renderNavigator = (open: boolean) =>
  render(
    <MemoryRouter>
      <SnapshotNavigator
        open={open}
        entries={[
          {
            snapshotId: 9,
            isCurrent: true,
            responseCount: 0,
            firstResponseAt: null,
            lastResponseAt: null,
            changes: null,
          },
        ]}
        fields={{
          currentSnapshotId: 9,
          currentFields: [],
          bySnapshotId: new Map(),
          failures: [],
        }}
        formIds={[4]}
        selectedSnapshotId={null}
        onSelectVersion={() => {}}
        onReassign={null}
      />
    </MemoryRouter>,
    queryWrapper(),
  );

it("shows when each version was first saved", async () => {
  renderNavigator(true);

  expect(await screen.findByText(/^First saved Mar 1[45]/)).toBeTruthy();
  expect(requested).toEqual(["4"]);
});

it("loads nothing while closed", async () => {
  renderNavigator(false);

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requested).toEqual([]);
});

it("says so when version dates fail to load", async () => {
  status = 500;
  renderNavigator(true);

  expect(
    await screen.findByText(
      "Couldn't load when each version was first saved. Everything else here still applies.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("First saved date unavailable")).toBeTruthy();
});
