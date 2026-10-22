import type { SetPriorityDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, mock } from "bun:test";
import { useSetPrioritiesAdmin } from "./useSetPrioritiesAdmin";

let saveStatus = 200;
let saved: SetPriorityDto | null = null;
let releaseSave: Promise<void> = Promise.resolve();

serveApi(
  routes({
    "POST /actions/priorities": async ({ request }) => {
      await releaseSave;
      if (saveStatus !== 200) {
        return Response.json({}, { status: saveStatus });
      }
      saved = await request.json();
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  saveStatus = 200;
  saved = null;
  releaseSave = Promise.resolve();
});

const body: SetPriorityDto = {
  actionPriorities: [{ id: 1, priority: 2 }],
  generalUpdatePriorities: [{ id: 4, priority: 1 }],
};

const renderSave = () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.actionsAllAdmin(), []);
  query.client.setQueryData(queryKeys.generalUpdatesAdmin(), []);
  const invalidated = () =>
    [queryKeys.actionsAllAdmin(), queryKeys.generalUpdatesAdmin()].map(
      (key) => query.client.getQueryState(key)?.isInvalidated,
    );
  const invalidatedOnSuccess: (boolean | undefined)[][] = [];
  const onSuccess = mock(() => invalidatedOnSuccess.push(invalidated()));
  const onError = mock();
  const view = renderHook(
    () => useSetPrioritiesAdmin({ onSuccess, onError }),
    query,
  );
  return { view, invalidated, invalidatedOnSuccess, onError };
};

it("saves the order and invalidates both lists after calling onSuccess", async () => {
  const { view, invalidated, invalidatedOnSuccess } = renderSave();

  await act(() => view.result.current.mutateAsync(body));

  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(saved).toEqual(body);
  expect(invalidatedOnSuccess).toEqual([[false, false]]);
  expect(invalidated()).toEqual([true, true]);
});

it("surfaces a refused save and leaves both lists alone", async () => {
  saveStatus = 403;
  const { view, invalidated, onError } = renderSave();

  await act(() =>
    expect(view.result.current.mutateAsync(body)).rejects.toMatchObject({
      statusCode: 403,
    }),
  );

  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(invalidated()).toEqual([false, false]);
  expect(onError.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403 });
});

it("reports a refused save that lands after the caller unmounts", async () => {
  saveStatus = 500;
  let release = () => {};
  releaseSave = new Promise((resolve) => (release = resolve));
  const { view, onError } = renderSave();

  act(() => view.result.current.mutate(body));
  view.unmount();
  release();

  await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
});
