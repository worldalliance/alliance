import { act, renderHook, waitFor } from "@testing-library/react";
import type { ActionDto } from "../client";
import { FilterMode, withOptimisticDismissal } from "./actionUtils";
import {
  filterActions,
  useDismissActionMutation,
  useInvalidateActions,
  useMarkActionCompleted,
} from "./actionsListPage";
import { queryKeys } from "./queryKeys";
import { makeAction, makeViewer } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";

const api = serveApi(routes({}));

describe("filterActions", () => {
  it("keeps draft staff previews out of the All list", () => {
    const live = makeAction({ id: 1 });
    const preview = makeAction({
      id: 2,
      status: "draft",
      viewer: makeViewer({ staffPreview: true }),
    });

    expect(filterActions([live, preview], FilterMode.All)).toEqual([live]);
  });

  it("lists a non-draft staff preview in All as it would without preview", () => {
    const preview = makeAction({
      status: "office_action",
      viewer: makeViewer({ staffPreview: true, memberActionStarted: false }),
    });

    expect(filterActions([preview], FilterMode.All)).toEqual([preview]);
  });
});

it("marks the actions list and the general updates unread count stale", () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.actions(), [makeAction({ id: 1 })]);
  client.setQueryData(queryKeys.generalUpdatesUnread(), []);
  const invalidate = renderHook(() => useInvalidateActions(), { wrapper })
    .result.current;

  act(() => invalidate());

  expect(client.getQueryState(queryKeys.actions())?.isInvalidated).toBe(true);
  expect(
    client.getQueryState(queryKeys.generalUpdatesUnread())?.isInvalidated,
  ).toBe(true);
});

it("marks only the given cached action completed and marks the list stale", () => {
  const { client, wrapper } = queryWrapper();
  const other = makeAction({ id: 2 });
  client.setQueryData(queryKeys.actions(), [makeAction({ id: 1 }), other]);
  const markCompleted = renderHook(() => useMarkActionCompleted(), { wrapper })
    .result.current;

  act(() => markCompleted(1));

  const [marked, untouched] =
    client.getQueryData<ActionDto[]>(queryKeys.actions()) ?? [];
  expect(marked?.userRelation).toBe("completed");
  expect(untouched).toBe(other);
  expect(client.getQueryState(queryKeys.actions())?.isInvalidated).toBe(true);
});

it("dismisses an action on the server, then hides it in the cached list", async () => {
  const dismissed: string[] = [];
  api.alsoServing({
    "POST /actions/dismiss/:id": ({ params }) => {
      dismissed.push(params.id);
      return new Response(null, { status: 201 });
    },
  });
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.actions(), [makeAction({ id: 1 })]);
  const view = renderHook(() => useDismissActionMutation(), { wrapper });

  await act(() => view.result.current.mutateAsync(1));
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));

  expect(dismissed).toEqual(["1"]);
  expect(client.getQueryData<ActionDto[]>(queryKeys.actions())?.[0]).toEqual(
    withOptimisticDismissal(makeAction({ id: 1 })),
  );
});
