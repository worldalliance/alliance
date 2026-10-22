import {
  displayOnlyToFormSchema,
  emptyDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { generalUpdateAdmin } from "./testing/generalUpdateAdmin";
import { useGeneralUpdateAdmin } from "./useGeneralUpdateAdmin";

let findStatus = 200;
let updateStatus = 200;
let fetched = 0;
let findDelay = 0;
let servedSnapshotId = 1;

serveApi(
  routes({
    "GET /actions/generalUpdates/admin/:id": async ({ params }) => {
      fetched += 1;
      await new Promise((resolve) => setTimeout(resolve, findDelay));
      return findStatus === 200
        ? Response.json(
            generalUpdateAdmin(Number(params.id), "Weekly note", {
              schema: emptyDisplayOnlySchema(),
              schemaSnapshotId: servedSnapshotId,
            }),
          )
        : Response.json({}, { status: findStatus });
    },
    "POST /actions/generalUpdates/create": () =>
      Response.json(generalUpdateAdmin(2, "New")),
    "PATCH /actions/generalUpdates/:id": ({ params }) =>
      updateStatus === 200
        ? Response.json(
            generalUpdateAdmin(Number(params.id), "Renamed", {
              schemaSnapshotId: 5,
            }),
          )
        : Response.json({}, { status: updateStatus }),
  }),
);

afterEach(() => {
  findStatus = 200;
  updateStatus = 200;
  fetched = 0;
  findDelay = 0;
  servedSnapshotId = 1;
});

const renderUpdate = (id: number | null) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.generalUpdatesAdmin(), []);
  const view = renderHook(() => useGeneralUpdateAdmin(id), query);
  const listInvalidated = () =>
    query.client.getQueryState(queryKeys.generalUpdatesAdmin())?.isInvalidated;
  return { view, client: query.client, listInvalidated };
};

const saveEmptySchema = (
  view: ReturnType<typeof renderUpdate>["view"],
  expectedSnapshotId: number,
) =>
  view.result.current.saveSchema({
    schema: displayOnlyToFormSchema(emptyDisplayOnlySchema()),
    expectedSnapshotId,
  });

it("loads the general update", async () => {
  const { view } = renderUpdate(1);

  await waitFor(() =>
    expect(view.result.current.query.data).toMatchObject({
      id: 1,
      name: "Weekly note",
    }),
  );
});

it("requests nothing without an id", async () => {
  const { view } = renderUpdate(null);

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(view.result.current.query.isLoading).toBe(false);
  expect(fetched).toBe(0);
});

it("reports a failed load", async () => {
  findStatus = 404;
  const { view } = renderUpdate(1);

  await waitFor(() => expect(view.result.current.query.isError).toBe(true));
});

it("caches a created general update and refreshes the list", async () => {
  const { view, client, listInvalidated } = renderUpdate(null);

  view.result.current.create.mutate({ name: "New", useManualCohort: false });

  await waitFor(() => expect(view.result.current.create.isSuccess).toBe(true));
  expect(client.getQueryData(queryKeys.generalUpdateAdmin(2))).toEqual(
    generalUpdateAdmin(2, "New"),
  );
  expect(listInvalidated()).toBe(true);
});

it("caches an updated general update and refreshes the list", async () => {
  const { view, listInvalidated } = renderUpdate(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());

  view.result.current.update.mutate({ name: "Renamed" });

  await waitFor(() =>
    expect(view.result.current.query.data?.name).toBe("Renamed"),
  );
  expect(listInvalidated()).toBe(true);
});

it("keeps the saved general update over a reload that started before the save", async () => {
  const { view, client } = renderUpdate(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());
  findDelay = 50;
  const reload = client.refetchQueries({
    queryKey: queryKeys.generalUpdateAdmin(1),
  });

  view.result.current.update.mutate({ name: "Renamed" });

  await waitFor(() => expect(view.result.current.update.isSuccess).toBe(true));
  await reload;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(client.getQueryData(queryKeys.generalUpdateAdmin(1))).toMatchObject({
    name: "Renamed",
  });
});

it("keeps the general update and list on a refused update", async () => {
  updateStatus = 400;
  const { view, listInvalidated } = renderUpdate(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());

  view.result.current.update.mutate({ name: "Renamed" });

  await waitFor(() => expect(view.result.current.update.isError).toBe(true));
  expect(view.result.current.query.data?.name).toBe("Weekly note");
  expect(listInvalidated()).toBe(false);
});

it("refuses an update without an id", async () => {
  const { view } = renderUpdate(null);

  view.result.current.update.mutate({ name: "Renamed" });

  await waitFor(() =>
    expect(view.result.current.update.error?.message).toBe(
      "No general update to update",
    ),
  );
});

it("caches saved content and refreshes the list", async () => {
  const { view, listInvalidated } = renderUpdate(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());

  let result: Awaited<ReturnType<typeof saveEmptySchema>> | undefined;
  await act(async () => {
    result = await saveEmptySchema(view, 1);
  });

  expect(result).toEqual({ ok: true, value: { snapshotId: 5 } });
  await waitFor(() =>
    expect(view.result.current.query.data?.schemaSnapshotId).toBe(5),
  );
  expect(listInvalidated()).toBe(true);
});

it("caches the other side's content on a conflicting save", async () => {
  updateStatus = 409;
  const { view } = renderUpdate(1);
  await waitFor(() => expect(view.result.current.query.data).toBeDefined());
  servedSnapshotId = 7;

  let result: Awaited<ReturnType<typeof saveEmptySchema>> | undefined;
  await act(async () => {
    result = await saveEmptySchema(view, 1);
  });

  expect(result).toMatchObject({ ok: false, error: { theirsSnapshotId: 7 } });
  await waitFor(() =>
    expect(view.result.current.query.data?.schemaSnapshotId).toBe(7),
  );
});
