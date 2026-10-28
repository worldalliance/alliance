import { renderHook, waitFor } from "@testing-library/react";
import { useActionHandlers } from "./actionPage";
import { queryKeys } from "./queryKeys";
import { makeAction, makeViewer } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";

let getResponse: () => Response | Promise<Response>;
let requests = 0;

serveApi(
  routes({
    "GET /actions/slug/7": () => {
      requests++;
      return getResponse();
    },
    "GET /actions/slug/8": () => {
      requests++;
      return Response.json(makeAction({ id: 8, name: "Fetched" }));
    },
  }),
);

beforeEach(() => {
  requests = 0;
  getResponse = () => Response.json(makeAction({ id: 7, usersCompleted: 2 }));
});

const renderHandlers = (params?: { reloadTasks?: () => unknown }) => {
  const { client, wrapper } = queryWrapper();
  const hook = renderHook(
    ({ isAuthenticated }) =>
      useActionHandlers(7, isAuthenticated, params?.reloadTasks ?? (() => {})),
    { wrapper, initialProps: { isAuthenticated: true } },
  );
  return { client, hook };
};

it("loads the action", async () => {
  const { hook } = renderHandlers();

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.action).toMatchObject({ id: 7 });
  expect(hook.result.current.notFound).toBe(false);
});

it("reports a 404 as not found", async () => {
  getResponse = () => Response.json({}, { status: 404 });

  const { hook } = renderHandlers();

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.action).toBeNull();
  expect(hook.result.current.notFound).toBe(true);
});

it("does not report a server failure as not found", async () => {
  getResponse = () => Response.json({}, { status: 500 });

  const { hook } = renderHandlers();

  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.action).toBeNull();
  expect(hook.result.current.notFound).toBe(false);
});

it("keeps the action when a refetch is refused", async () => {
  const { hook } = renderHandlers();
  await waitFor(() => expect(hook.result.current.action).not.toBeNull());

  getResponse = () => Response.json({}, { status: 404 });
  await hook.result.current.refetchAction();

  await waitFor(() => expect(requests).toBe(2));
  expect(hook.result.current.action).toMatchObject({ id: 7 });
  expect(hook.result.current.notFound).toBe(false);
});

it("reports not found when the load over a cached copy is refused", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.action(7), makeAction({ id: 7 }));
  getResponse = () => Response.json({}, { status: 404 });

  const hook = renderHook(() => useActionHandlers(7, true, () => {}), {
    wrapper,
  });

  await waitFor(() => expect(hook.result.current.notFound).toBe(true));
  expect(hook.result.current.action).toBeNull();
});

it("refetches on mount over a fresh cached copy", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.action(7), makeAction({ id: 7, name: "Old" }));
  getResponse = () => Response.json(makeAction({ id: 7, name: "New" }));

  const hook = renderHook(() => useActionHandlers(7, true, () => {}), {
    wrapper,
  });

  expect(hook.result.current.action?.name).toBe("Old");
  await waitFor(() => expect(hook.result.current.action?.name).toBe("New"));
});

it("refetches when the action id changes over a fresh cached copy", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(
    queryKeys.action(8),
    makeAction({ id: 8, name: "Cached" }),
  );
  const hook = renderHook(
    ({ actionId }) => useActionHandlers(actionId, true, () => {}),
    { wrapper, initialProps: { actionId: 7 } },
  );
  await waitFor(() => expect(requests).toBe(1));

  hook.rerender({ actionId: 8 });

  await waitFor(() => expect(hook.result.current.action?.name).toBe("Fetched"));
  expect(requests).toBe(2);
});

it("refetches when the viewer signs in or out", async () => {
  const { hook } = renderHandlers();
  await waitFor(() => expect(requests).toBe(1));

  hook.rerender({ isAuthenticated: false });

  await waitFor(() => expect(requests).toBe(2));
});

it("marks the action completed in the shared cache and reloads tasks", async () => {
  const reloadTasks = jest.fn();
  const { client, hook } = renderHandlers({ reloadTasks });
  await waitFor(() => expect(hook.result.current.action).not.toBeNull());

  await hook.result.current.onCompleteAction();

  expect(client.getQueryData(queryKeys.action(7))).toMatchObject({
    userRelation: "completed",
    usersCompleted: 3,
  });
  expect(reloadTasks).toHaveBeenCalledTimes(1);
});

it("does not count a completion the server already reported", async () => {
  getResponse = () =>
    Response.json(
      makeAction({
        id: 7,
        usersCompleted: 3,
        userRelation: "completed",
        viewer: makeViewer({ relation: "completed" }),
      }),
    );
  const { client, hook } = renderHandlers();
  await waitFor(() => expect(hook.result.current.action).not.toBeNull());

  await hook.result.current.onCompleteAction();

  expect(client.getQueryData(queryKeys.action(7))).toMatchObject({
    usersCompleted: 3,
  });
});

it("marks the action declined in the shared cache and reloads tasks", async () => {
  const reloadTasks = jest.fn();
  const { client, hook } = renderHandlers({ reloadTasks });
  await waitFor(() => expect(hook.result.current.action).not.toBeNull());

  await hook.result.current.onOptOutAction();

  expect(client.getQueryData(queryKeys.action(7))).toMatchObject({
    userRelation: "declined",
    usersCompleted: 2,
  });
  expect(reloadTasks).toHaveBeenCalledTimes(1);
});

it("keeps a completion written while a refetch is in flight", async () => {
  const { client, hook } = renderHandlers();
  await waitFor(() => expect(hook.result.current.action).not.toBeNull());
  let respond = () => {};
  getResponse = () => {
    const response = Response.json(makeAction({ id: 7, usersCompleted: 2 }));
    return new Promise<Response>((resolve) => {
      respond = () => resolve(response);
    });
  };
  void hook.result.current.refetchAction();
  await waitFor(() => expect(requests).toBe(2));

  await hook.result.current.onCompleteAction();
  respond();
  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(client.getQueryData(queryKeys.action(7))).toMatchObject({
    userRelation: "completed",
    usersCompleted: 3,
  });
});
