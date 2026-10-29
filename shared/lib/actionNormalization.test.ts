import { act, renderHook, waitFor } from "@testing-library/react";
import {
  actionsQuery,
  useActionsQuery,
  useRecordActionRelation,
} from "./actionsListPage";
import { actionStore } from "./actionStore";
import { queryKeys } from "./queryKeys";
import { makeAction, makeProfile } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useAction } from "./useAction";
import { meCache } from "./useMe";

let listResponse: () => Response | Promise<Response>;
let detailResponse: () => Response | Promise<Response>;
let listRequests = 0;

serveApi(
  routes({
    "GET /actions/loggedIn": () => {
      listRequests++;
      return listResponse();
    },
    "GET /actions/slug/7": () => detailResponse(),
  }),
);

beforeEach(() => {
  listRequests = 0;
  listResponse = () => Response.json([makeAction({ id: 7, name: "List" })]);
  detailResponse = () => Response.json(makeAction({ id: 7, name: "Detail" }));
});

it("shares a detail response with an already loaded list", async () => {
  const { wrapper } = queryWrapper();
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(list.result.current.data?.[0]?.name).toBe("List"));

  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() =>
    expect(detail.result.current.query.data?.name).toBe("Detail"),
  );

  await waitFor(() =>
    expect(list.result.current.data?.[0]).toEqual(
      detail.result.current.query.data,
    ),
  );
  expect(listRequests).toBe(1);
});

it("shares a list response with an already loaded detail", async () => {
  const { wrapper } = queryWrapper();
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() =>
    expect(detail.result.current.query.data?.name).toBe("Detail"),
  );

  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(list.result.current.data?.[0]?.name).toBe("List"));

  await waitFor(() =>
    expect(detail.result.current.query.data).toEqual(
      list.result.current.data?.[0],
    ),
  );
});

it("keeps the detail's relations when a later list response omits them", async () => {
  detailResponse = () =>
    Response.json(makeAction({ id: 7, authors: [makeProfile(3)] }));
  const { wrapper } = queryWrapper();
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() =>
    expect(detail.result.current.query.data?.authors).toHaveLength(1),
  );

  listResponse = () =>
    Response.json([makeAction({ id: 7, name: "List", authors: [] })]);
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(list.result.current.data?.[0]?.name).toBe("List"));

  expect(detail.result.current.query.data?.name).toBe("List");
  expect(detail.result.current.query.data?.authors).toEqual([makeProfile(3)]);
});

it("keeps the newer detail when an older list request finishes last", async () => {
  const { wrapper } = queryWrapper();
  let finish = () => {};
  listResponse = () =>
    new Promise<Response>((resolve) => {
      finish = () =>
        resolve(Response.json([makeAction({ id: 7, name: "Older" })]));
    });
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(listRequests).toBe(1));
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() =>
    expect(detail.result.current.query.data?.name).toBe("Detail"),
  );

  act(finish);

  await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
  expect(list.result.current.data?.[0]?.name).toBe("Detail");
});

it("keeps an older detail's relations when a newer list finishes first", async () => {
  const { wrapper } = queryWrapper();
  const pending = Promise.withResolvers<Response>();
  detailResponse = () => pending.promise;
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() =>
    expect(detail.result.current.query.isFetching).toBe(true),
  );
  listResponse = () =>
    Response.json([makeAction({ id: 7, name: "List", authors: [] })]);
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(list.result.current.data?.[0]?.name).toBe("List"));

  pending.resolve(
    Response.json(
      makeAction({ id: 7, name: "Detail", authors: [makeProfile(3)] }),
    ),
  );

  await waitFor(() =>
    expect(detail.result.current.query.data?.authors).toEqual([makeProfile(3)]),
  );
  expect(detail.result.current.query.data?.name).toBe("List");
});

it("applies a completion to both views without double-counting repeated confirmations", async () => {
  const { wrapper } = queryWrapper();
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() => expect(detail.result.current.query.isSuccess).toBe(true));
  const completedBefore = detail.result.current.query.data!.usersCompleted;

  await act(() => detail.result.current.markCompleted());
  await act(() => detail.result.current.markCompleted());

  await waitFor(() =>
    expect(list.result.current.data?.[0]?.viewer?.relation).toBe("completed"),
  );
  expect(list.result.current.data?.[0]?.usersCompleted).toBe(
    completedBefore + 1,
  );
  expect(detail.result.current.query.data?.usersCompleted).toBe(
    completedBefore + 1,
  );
});

it("keeps a confirmation made while the first list is still loading", async () => {
  const { client, wrapper } = queryWrapper();
  const pending = Promise.withResolvers<Response>();
  listResponse = () => pending.promise;
  const list = renderHook(
    () => ({ query: useActionsQuery(), record: useRecordActionRelation() }),
    { wrapper },
  );
  await waitFor(() => expect(listRequests).toBe(1));

  act(() =>
    list.result.current.record({
      actionId: 7,
      relation: "completed",
      session: actionStore(client).getSession(),
    }),
  );
  pending.resolve(Response.json([makeAction({ id: 7 })]));

  await waitFor(() => expect(list.result.current.query.isSuccess).toBe(true));
  expect(list.result.current.query.data?.[0]?.viewer?.relation).toBe(
    "completed",
  );
  expect(actionStore(client).get(7)?.usersCompleted).toBe(1);
});

it("retains a detail when a list no longer includes its action", async () => {
  const { wrapper } = queryWrapper();
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() => expect(detail.result.current.query.isSuccess).toBe(true));
  listResponse = () => Response.json([]);

  const list = renderHook(() => useActionsQuery(), { wrapper });

  await waitFor(() => expect(list.result.current.data).toEqual([]));
  expect(detail.result.current.query.data?.name).toBe("Detail");
});

it("accepts an older successful load when the newer request fails", async () => {
  const { wrapper } = queryWrapper();
  const pending = Promise.withResolvers<Response>();
  listResponse = () => pending.promise;
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(listRequests).toBe(1));
  detailResponse = () => Response.json({}, { status: 500 });
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() => expect(detail.result.current.query.isError).toBe(true));

  pending.resolve(Response.json([makeAction({ id: 7, name: "Available" })]));

  await waitFor(() =>
    expect(list.result.current.data?.[0]?.name).toBe("Available"),
  );
  expect(detail.result.current.query.isError).toBe(true);
});

it("keeps different clients' viewer state separate", async () => {
  const first = queryWrapper();
  const second = queryWrapper();
  const a = renderHook(() => useAction(7), { wrapper: first.wrapper });
  const b = renderHook(() => useAction(7), { wrapper: second.wrapper });
  await waitFor(() =>
    expect(
      a.result.current.query.isSuccess && b.result.current.query.isSuccess,
    ).toBe(true),
  );

  await act(() => a.result.current.markCompleted());

  expect(a.result.current.query.data?.viewer?.relation).toBe("completed");
  expect(b.result.current.query.data?.viewer?.relation).toBe("none");
});

it("clears mounted action consumers at a session boundary", async () => {
  const { client, wrapper } = queryWrapper();
  const detail = renderHook(({ enabled }) => useAction(7, { enabled }), {
    wrapper,
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(detail.result.current.query.isSuccess).toBe(true));
  detail.rerender({ enabled: false });

  act(() => meCache(client).clear());

  await waitFor(() => expect(detail.result.current.query.data).toBeUndefined());
  expect(actionStore(client).get(7)).toBeUndefined();
});

it("ignores a detail callback from the previous session", async () => {
  const { client, wrapper } = queryWrapper();
  const detail = renderHook(() => useAction(7), { wrapper });
  await waitFor(() => expect(detail.result.current.query.isSuccess).toBe(true));
  const oldConfirmation = detail.result.current.markCompleted;

  act(() => meCache(client).clear());
  await waitFor(() => expect(actionStore(client).get(7)).toBeDefined());
  await act(oldConfirmation);

  expect(actionStore(client).get(7)?.viewer?.relation).toBe("none");
});

it("discards a cancelled list response even when the transport ignores abort", async () => {
  const { client } = queryWrapper();
  const pending = Promise.withResolvers<Response>();
  listResponse = () => pending.promise;
  const loading = client.fetchQuery(actionsQuery).catch(() => undefined);
  await waitFor(() => expect(listRequests).toBe(1));

  await client.cancelQueries({ queryKey: queryKeys.actions() });
  pending.resolve(Response.json([makeAction({ id: 7 })]));
  await loading;
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(actionStore(client).get(7)).toBeUndefined();
});

it("does not replace an authenticated record with an optional-auth fallback", async () => {
  const { wrapper } = queryWrapper();
  const list = renderHook(() => useActionsQuery(), { wrapper });
  await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
  detailResponse = () =>
    Response.json(
      makeAction({
        id: 7,
        name: "Anonymous",
        reqAuthenticated: false,
        viewer: undefined,
      }),
    );

  const detail = renderHook(() => useAction(7), { wrapper });

  await waitFor(() => expect(detail.result.current.query.isSuccess).toBe(true));
  expect(detail.result.current.query.data?.name).toBe("List");
  expect(detail.result.current.query.data?.viewer).toBeDefined();
});

it("discards an old session's response after a new session has loaded the same id", async () => {
  const { client } = queryWrapper();
  const pending = Promise.withResolvers<Response>();
  listResponse = () => pending.promise;
  const previous = client.fetchQuery(actionsQuery).catch(() => undefined);
  await waitFor(() => expect(listRequests).toBe(1));

  meCache(client).clear();
  listResponse = () =>
    Response.json([makeAction({ id: 7, name: "Current session" })]);
  await client.fetchQuery(actionsQuery);
  pending.resolve(
    Response.json([makeAction({ id: 7, name: "Previous session" })]),
  );
  await previous;
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(actionStore(client).get(7)?.name).toBe("Current session");
});
