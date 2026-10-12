import { act, renderHook, waitFor } from "@testing-library/react";
import { milliseconds } from "date-fns";
import type { ActionDto } from "../client";
import { useRecordActionRelation } from "./actionsListPage";
import { queryKeys } from "./queryKeys";
import { makeAction, makeViewer } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useTaskBadgeCount } from "./useTaskBadgeCount";

const api = serveApi(routes({}));

const serveActions = (respond: () => ActionDto[] | Promise<ActionDto[]>) =>
  api.alsoServing({
    "GET /actions/loggedIn": async () => Response.json(await respond()),
  });

const renderCount = (wrapper: ReturnType<typeof queryWrapper>["wrapper"]) =>
  renderHook(() => useTaskBadgeCount(), { wrapper });

it("is absent until the actions load, then counts only eligible ones", async () => {
  serveActions(() => [
    makeAction({ id: 1 }),
    makeAction({
      id: 2,
      optional: true,
      viewer: makeViewer({ optional: true, contractGap: true }),
    }),
    makeAction({ id: 3, viewer: makeViewer({ staffPreview: true }) }),
  ]);
  const view = renderCount(queryWrapper().wrapper);

  expect(view.result.current).toBeNull();
  await waitFor(() => expect(view.result.current).toBe(1));
});

it("keeps the last count when a refetch fails", async () => {
  api.alsoServing({
    "GET /actions/loggedIn": () => new Response(null, { status: 500 }),
  });
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.actions(), [makeAction({ id: 1 })]);
  const view = renderCount(wrapper);

  await act(() =>
    client.refetchQueries({ queryKey: queryKeys.actions() }).catch(() => {}),
  );

  expect(client.getQueryState(queryKeys.actions())?.status).toBe("error");
  expect(view.result.current).toBe(1);
});

it("drops an action at its deadline without a refetch", async () => {
  const { client, wrapper } = queryWrapper({ staleTime: Infinity });
  const deadlineAt = new Date(Date.now() + milliseconds({ seconds: 0.2 }));
  client.setQueryData(queryKeys.actions(), [
    makeAction({ id: 1 }),
    makeAction({
      id: 2,
      viewer: makeViewer({ deadlineAt: deadlineAt.toISOString() }),
    }),
  ]);
  const view = renderCount(wrapper);

  expect(view.result.current).toBe(2);
  await waitFor(() => expect(view.result.current).toBe(1));
});
const refetchIntervalOf = (
  client: ReturnType<typeof queryWrapper>["client"],
) => {
  const query = client.getQueryCache().find({ queryKey: queryKeys.actions() });
  const interval = query?.observers[0]?.options.refetchInterval;
  return typeof interval === "function" && query ? interval(query) : interval;
};

it("refetches the actions every minute", async () => {
  serveActions(() => []);
  const { client, wrapper } = queryWrapper();
  const view = renderCount(wrapper);

  await waitFor(() => expect(view.result.current).toBe(0));
  expect(refetchIntervalOf(client)).toBe(milliseconds({ minutes: 1 }));
});

it("stops polling once the server refuses the signed-out viewer", async () => {
  api.alsoServing({
    "GET /actions/loggedIn": () => new Response(null, { status: 401 }),
  });
  const { client, wrapper } = queryWrapper();
  renderCount(wrapper);

  await waitFor(() =>
    expect(client.getQueryState(queryKeys.actions())?.status).toBe("error"),
  );
  expect(refetchIntervalOf(client)).toBe(false);
});

it("drops a confirmed withdrawal at once, and an older in-flight fetch can't restore it", async () => {
  let releaseStale: (actions: ActionDto[]) => void = () => {};
  let calls = 0;
  serveActions(() => {
    calls += 1;
    return calls === 1
      ? new Promise<ActionDto[]>((resolve) => (releaseStale = resolve))
      : [makeAction({ id: 1, viewer: makeViewer({ relation: "withdrawn" }) })];
  });
  const { client, wrapper } = queryWrapper({ staleTime: Infinity });
  client.setQueryData(queryKeys.actions(), [makeAction({ id: 1 })]);
  const view = renderHook(
    () => ({
      count: useTaskBadgeCount(),
      recordRelation: useRecordActionRelation(),
    }),
    { wrapper },
  );
  void client.refetchQueries({ queryKey: queryKeys.actions() });
  await waitFor(() => expect(calls).toBe(1));

  act(() => view.result.current.recordRelation(1, "declined"));
  await waitFor(() => expect(view.result.current.count).toBe(0));

  releaseStale([makeAction({ id: 1 })]);
  await waitFor(() => expect(calls).toBe(2));
  await waitFor(() =>
    expect(client.getQueryState(queryKeys.actions())?.fetchStatus).toBe("idle"),
  );
  expect(view.result.current.count).toBe(0);
});
