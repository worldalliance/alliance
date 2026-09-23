import { renderHook, waitFor } from "@testing-library/react";
import { parseGeneralUpdate } from "./generalUpdates";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  useAllGeneralUpdates,
  useUnreadGeneralUpdates,
} from "./useGeneralUpdates";

const serverError = () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

const api = serveApi(
  routes({
    "GET /actions/generalUpdates/unread": serverError,
    "GET /actions/generalUpdates": serverError,
  }),
);

const cached = [
  parseGeneralUpdate({ id: 1, name: "Update", priority: 0, schema: {} }),
];

const generalUpdateHooks = [
  ["unread", useUnreadGeneralUpdates, queryKeys.generalUpdatesUnread()],
  ["all", useAllGeneralUpdates, queryKeys.generalUpdatesAll()],
] as const;

it.each(generalUpdateHooks)(
  "a failed %s general updates fetch reports an error",
  async (_, useHook) => {
    const { wrapper } = queryWrapper();

    const hook = renderHook(() => useHook(), { wrapper });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.generalUpdates).toEqual([]);
    expect(hook.result.current.didFail).toBe(true);
  },
);

it.each(generalUpdateHooks)(
  "a failed %s general updates refetch keeps the updates it had",
  async (_, useHook, key) => {
    const { client, wrapper } = queryWrapper();
    client.setQueryData(key, cached);

    const hook = renderHook(() => useHook(), { wrapper });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.generalUpdates).toBe(cached);
    expect(hook.result.current.didFail).toBe(false);
  },
);

it("a failed unread general updates fetch is not retried", async () => {
  let requests = 0;
  api.alsoServing({
    "GET /actions/generalUpdates/unread": () => {
      requests += 1;
      return serverError();
    },
  });
  const { wrapper } = queryWrapper({ retry: 3 });

  const hook = renderHook(() => useUnreadGeneralUpdates(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(requests).toBe(1);
});
