import { act, renderHook, waitFor } from "@testing-library/react";
import { actionStore } from "./actionStore";
import { FilterMode, withOptimisticDismissal } from "./actionUtils";
import {
  filterActions,
  useDismissActionMutation,
  useInvalidateActions,
  useRecordActionRelation,
} from "./actionsListPage";
import { queryKeys } from "./queryKeys";
import { makeAction, makeViewer } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { seedAction, seedActions } from "./testing/seedActions";
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

  it("lists the actions the viewer completed under Completed by me", () => {
    const completed = makeAction({
      id: 1,
      viewer: makeViewer({ relation: "completed" }),
    });
    const withdrawn = makeAction({
      id: 2,
      viewer: makeViewer({ relation: "withdrawn" }),
    });
    const todo = makeAction({ id: 3 });

    expect(
      filterActions([completed, withdrawn, todo], FilterMode.CompletedByMe),
    ).toEqual([completed]);
  });
});

it("invalidates action lists, details, and unread general updates together", () => {
  const { client, wrapper } = queryWrapper();
  seedActions(client, [makeAction({ id: 1 })]);
  seedAction(client, makeAction({ id: 1 }));
  client.setQueryData(queryKeys.generalUpdatesUnread(), []);
  const invalidate = renderHook(() => useInvalidateActions(), { wrapper })
    .result.current;

  act(() => invalidate());

  expect(client.getQueryState(queryKeys.actions())?.isInvalidated).toBe(true);
  expect(client.getQueryState(queryKeys.action(1))?.isInvalidated).toBe(true);
  expect(
    client.getQueryState(queryKeys.generalUpdatesUnread())?.isInvalidated,
  ).toBe(true);
});

it("marks only the given cached action completed and marks the list stale", () => {
  const { client, wrapper } = queryWrapper();
  const other = makeAction({ id: 2 });
  seedActions(client, [makeAction({ id: 1 }), other]);
  const recordRelation = renderHook(() => useRecordActionRelation(), {
    wrapper,
  }).result.current;

  act(() => recordRelation(1, "completed"));

  const marked = actionStore(client).get(1);
  const untouched = actionStore(client).get(2);
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
  seedActions(client, [makeAction({ id: 1 })]);
  const view = renderHook(() => useDismissActionMutation(), { wrapper });

  await act(() => view.result.current.mutateAsync(1));
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));

  expect(dismissed).toEqual(["1"]);
  expect(actionStore(client).get(1)).toEqual(
    withOptimisticDismissal(makeAction({ id: 1 })),
  );
});

it("leaves the cached action alone when the server refuses the dismissal", async () => {
  api.alsoServing({
    "POST /actions/dismiss/:id": () =>
      Response.json({ message: "Nope" }, { status: 500 }),
  });
  const { client, wrapper } = queryWrapper();
  seedActions(client, [makeAction({ id: 1 })]);
  const view = renderHook(() => useDismissActionMutation(), { wrapper });

  await act(() => view.result.current.mutateAsync(1).catch(() => {}));

  await waitFor(() => expect(view.result.current.isError).toBe(true));
  expect(actionStore(client).get(1)).toEqual(makeAction({ id: 1 }));
});
