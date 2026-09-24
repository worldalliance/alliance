import { parseGeneralUpdate } from "@alliance/shared/lib/generalUpdates";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTaskActionsData } from "./useTaskActionsData";

let unreadUpdates: () => Promise<Response>;

serveApi(
  routes({
    "GET /actions/loggedIn": () => Response.json([]),
    "GET /actions/generalUpdates/unread": () => unreadUpdates(),
  }),
);

it("offers a retry that stays up until general updates load", async () => {
  unreadUpdates = async () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useTaskActionsData(), { wrapper });
  await waitFor(() =>
    expect(hook.result.current.generalUpdatesFailure).not.toBeNull(),
  );

  const { promise, resolve } = Promise.withResolvers<Response>();
  unreadUpdates = () => promise;
  act(() => hook.result.current.generalUpdatesFailure?.onRetry());

  await waitFor(() =>
    expect(hook.result.current.generalUpdatesFailure?.retrying).toBe(true),
  );
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.actions).toEqual([]);

  resolve(Response.json([]));
  await waitFor(() =>
    expect(hook.result.current.generalUpdatesFailure).toBeNull(),
  );
});

it("keeps the general updates it had when a refetch fails", async () => {
  unreadUpdates = async () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  const cached = [
    parseGeneralUpdate({ id: 1, name: "Update", priority: 0, schema: {} }),
  ];
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.generalUpdatesUnread(), cached);
  const hook = renderHook(() => useTaskActionsData(), { wrapper });

  await waitFor(() =>
    expect(client.getQueryState(queryKeys.generalUpdatesUnread())?.status).toBe(
      "error",
    ),
  );
  expect(hook.result.current.generalUpdates).toBe(cached);
  expect(hook.result.current.generalUpdatesFailure).toBeNull();
});
