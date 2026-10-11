import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  useResponseSnapshotMigrationAdmin,
  useResponseSnapshotMigrationsAdmin,
} from "./useResponseSnapshotMigrationAdmin";

afterEach(cleanup);

const snapshot = (id: number) => ({
  id,
  hash: `hash-${id}`,
  createdAt: "2026-01-01T00:00:00.000Z",
  schema: { pages: [], outputViews: [] },
});

let requested: string[] = [];
let migrated: { formId: string; body: unknown }[] = [];
let loadStatus = 200;
let failingFormId: string | null = null;
let migrateStatus = 200;

serveApi(
  routes({
    "GET /tasks/forms/:formId/snapshotMigration": ({ params }) => {
      requested.push(params.formId);
      if (loadStatus !== 200 || params.formId === failingFormId) {
        return Response.json({}, { status: 500 });
      }
      return Response.json({
        formTitle: "Survey",
        latestSnapshot: snapshot(9),
        groups: [{ snapshot: snapshot(7), responses: [] }],
      });
    },
    "PATCH /tasks/forms/:formId/responseSnapshots": async ({
      request,
      params,
    }) => {
      migrated.push({ formId: params.formId, body: await request.json() });
      if (migrateStatus !== 200) {
        return Response.json({}, { status: migrateStatus });
      }
      return Response.json({ updatedCount: 2 });
    },
  }),
);

beforeEach(() => {
  requested = [];
  migrated = [];
  loadStatus = 200;
  failingFormId = null;
  migrateStatus = 200;
});

it("loads the form's snapshot groups", async () => {
  const { result } = renderHook(
    () => useResponseSnapshotMigrationAdmin(5),
    queryWrapper(),
  );

  await waitFor(() => expect(result.current.data?.formTitle).toBe("Survey"));
  expect(result.current.data?.groups[0]?.snapshot.id).toBe(7);
  expect(requested).toEqual(["5"]);
});

it("requests nothing without a form id", async () => {
  const { result } = renderHook(
    () => useResponseSnapshotMigrationAdmin(undefined),
    queryWrapper(),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(result.current.data).toBeUndefined();
  expect(requested).toEqual([]);
});

it("reports a failed load", async () => {
  loadStatus = 500;
  const { result } = renderHook(
    () => useResponseSnapshotMigrationAdmin(5),
    queryWrapper(),
  );

  await waitFor(() => expect(result.current.isError).toBe(true));
});

it("reassigns responses, resolves to the updated count, and reloads the groups", async () => {
  const { result } = renderHook(
    () => useResponseSnapshotMigrationAdmin(5),
    queryWrapper(),
  );
  await waitFor(() => expect(requested).toEqual(["5"]));

  let updated: number | undefined;
  await act(async () => {
    updated = await result.current.migrate.mutateAsync({
      responseIds: [11, 12],
      targetSnapshotId: 9,
    });
  });

  expect(updated).toBe(2);
  expect(migrated).toEqual([
    { formId: "5", body: { responseIds: [11, 12], targetSnapshotId: 9 } },
  ]);
  expect(requested).toEqual(["5", "5"]);
});

it("reports a refused reassignment and reloads the groups", async () => {
  migrateStatus = 409;
  const { result } = renderHook(
    () => useResponseSnapshotMigrationAdmin(5),
    queryWrapper(),
  );
  await waitFor(() => expect(requested).toEqual(["5"]));

  await act(async () => {
    await result.current.migrate
      .mutateAsync({ responseIds: [11], targetSnapshotId: 9 })
      .catch(() => {});
  });

  await waitFor(() => expect(result.current.migrate.isError).toBe(true));
  expect(requested).toEqual(["5", "5"]);
});

it("loads every form's snapshot groups once enabled", async () => {
  const { result, rerender } = renderHook(
    ({ enabled }) => useResponseSnapshotMigrationsAdmin([5, 6], { enabled }),
    { ...queryWrapper(), initialProps: { enabled: false } },
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requested).toEqual([]);

  rerender({ enabled: true });

  await waitFor(() => expect(result.current.migrations).toHaveLength(2));
  expect([...requested].sort()).toEqual(["5", "6"]);
  expect(result.current.isPending).toBe(false);
  expect(result.current.isError).toBe(false);
});

it("reports a failed load among several forms, keeping the forms that loaded", async () => {
  failingFormId = "6";
  const { result } = renderHook(
    () => useResponseSnapshotMigrationsAdmin([5, 6], { enabled: true }),
    queryWrapper(),
  );

  await waitFor(() => expect(result.current.isError).toBe(true));
  await waitFor(() => expect(result.current.migrations).toHaveLength(1));
  expect(result.current.isPending).toBe(false);
});
