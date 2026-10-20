import {
  displayOnlyToFormSchema,
  emptyDisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { actionUpdateAdmin } from "./testing/actionUpdateAdmin";
import { useActionUpdateAdmin } from "./useActionUpdateAdmin";

let findStatus = 200;
let writeStatus = 200;
let fetched = 0;
let findDelay = 0;
let servedSnapshotId = 3;

const refused = () => Response.json({}, { status: writeStatus });

serveApi(
  routes({
    "GET /actions/updates/admin/:id": async ({ params }) => {
      fetched += 1;
      await new Promise((resolve) => setTimeout(resolve, findDelay));
      return findStatus === 200
        ? Response.json(
            actionUpdateAdmin({
              id: Number(params.id),
              schemaSnapshotId: servedSnapshotId,
            }),
          )
        : Response.json({}, { status: findStatus });
    },
    "PATCH /actions/updateUpdate/:id": ({ params }) =>
      writeStatus === 200
        ? Response.json(
            actionUpdateAdmin({
              id: Number(params.id),
              title: "Renamed",
              schemaSnapshotId: 5,
            }),
          )
        : refused(),
    "POST /actions/updates/:id/notify": ({ params }) =>
      writeStatus === 200
        ? Response.json(
            actionUpdateAdmin({
              id: Number(params.id),
              notifiedAt: "2026-10-02T00:00:00.000Z",
            }),
          )
        : refused(),
    "POST /actions/updates/:id/publish-now": ({ params }) =>
      Response.json(
        actionUpdateAdmin({
          id: Number(params.id),
          visibleAt: "2026-10-02T00:00:00.000Z",
        }),
      ),
    "POST /actions/updates/:id/unpublish": ({ params }) =>
      Response.json(
        actionUpdateAdmin({
          id: Number(params.id),
          visibleAt: "2026-11-01T00:00:00.000Z",
        }),
      ),
  }),
);

afterEach(() => {
  findStatus = 200;
  writeStatus = 200;
  fetched = 0;
  findDelay = 0;
  servedSnapshotId = 3;
});

const renderUpdate = (id: number | null) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.actionAdmin(2), null);
  const view = renderHook(() => useActionUpdateAdmin(id), query);
  const actionInvalidated = () =>
    query.client.getQueryState(queryKeys.actionAdmin(2))?.isInvalidated;
  return { view, client: query.client, actionInvalidated };
};

const loaded = async (view: ReturnType<typeof renderUpdate>["view"]) =>
  waitFor(() => expect(view.result.current.query.data).toBeDefined());

it("loads the update", async () => {
  const { view } = renderUpdate(1);

  await waitFor(() =>
    expect(view.result.current.query.data).toMatchObject({
      id: 1,
      title: "Hearing",
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

it("caches updated details and refreshes the action", async () => {
  const { view, actionInvalidated } = renderUpdate(1);
  await loaded(view);

  view.result.current.update.mutate({ title: "Renamed" });

  await waitFor(() =>
    expect(view.result.current.query.data?.title).toBe("Renamed"),
  );
  expect(actionInvalidated()).toBe(true);
});

it("keeps the saved update over a reload that started before the save", async () => {
  const { view, client } = renderUpdate(1);
  await loaded(view);
  findDelay = 50;
  const reload = client.refetchQueries({
    queryKey: queryKeys.actionUpdateAdmin(1),
  });

  view.result.current.update.mutate({ title: "Renamed" });

  await waitFor(() => expect(view.result.current.update.isSuccess).toBe(true));
  await reload;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(client.getQueryData(queryKeys.actionUpdateAdmin(1))).toMatchObject({
    title: "Renamed",
  });
});

it("keeps the update and action on a refused update", async () => {
  writeStatus = 400;
  const { view, actionInvalidated } = renderUpdate(1);
  await loaded(view);

  view.result.current.update.mutate({ title: "Renamed" });

  await waitFor(() => expect(view.result.current.update.isError).toBe(true));
  expect(view.result.current.query.data?.title).toBe("Hearing");
  expect(actionInvalidated()).toBe(false);
});

it("refuses a write without an id", async () => {
  const { view } = renderUpdate(null);

  view.result.current.notify.mutate();

  await waitFor(() =>
    expect(view.result.current.notify.error?.message).toBe(
      "No action update to change",
    ),
  );
});

it("caches a sent notification and refreshes the action", async () => {
  const { view, actionInvalidated } = renderUpdate(1);
  await loaded(view);

  view.result.current.notify.mutate();

  await waitFor(() =>
    expect(view.result.current.query.data?.notifiedAt).toBe(
      "2026-10-02T00:00:00.000Z",
    ),
  );
  expect(actionInvalidated()).toBe(true);
});

it("keeps the update on a refused notification", async () => {
  writeStatus = 409;
  const { view } = renderUpdate(1);
  await loaded(view);

  view.result.current.notify.mutate();

  await waitFor(() => expect(view.result.current.notify.isError).toBe(true));
  expect(view.result.current.query.data?.notifiedAt).toBeNull();
});

it("caches a publish and an unpublish", async () => {
  const { view } = renderUpdate(1);
  await loaded(view);

  view.result.current.publishNow.mutate();
  await waitFor(() =>
    expect(view.result.current.query.data?.visibleAt).toBe(
      "2026-10-02T00:00:00.000Z",
    ),
  );

  view.result.current.unpublish.mutate();
  await waitFor(() =>
    expect(view.result.current.query.data?.visibleAt).toBe(
      "2026-11-01T00:00:00.000Z",
    ),
  );
});

it("caches saved content and refreshes the action", async () => {
  const { view, actionInvalidated } = renderUpdate(1);
  await loaded(view);

  let result:
    | Awaited<ReturnType<typeof view.result.current.saveSchema>>
    | undefined;
  await act(async () => {
    result = await view.result.current.saveSchema({
      schema: displayOnlyToFormSchema(emptyDisplayOnlySchema()),
      expectedSnapshotId: 3,
    });
  });

  expect(result).toEqual({ ok: true, value: { snapshotId: 5 } });
  await waitFor(() =>
    expect(view.result.current.query.data?.schemaSnapshotId).toBe(5),
  );
  expect(actionInvalidated()).toBe(true);
});

it("caches the other side's content on a conflicting save", async () => {
  writeStatus = 409;
  const { view } = renderUpdate(1);
  await loaded(view);
  servedSnapshotId = 7;

  let result:
    | Awaited<ReturnType<typeof view.result.current.saveSchema>>
    | undefined;
  await act(async () => {
    result = await view.result.current.saveSchema({
      schema: displayOnlyToFormSchema(emptyDisplayOnlySchema()),
      expectedSnapshotId: 3,
    });
  });

  expect(result).toMatchObject({ ok: false, error: { theirsSnapshotId: 7 } });
  await waitFor(() =>
    expect(view.result.current.query.data?.schemaSnapshotId).toBe(7),
  );
});
