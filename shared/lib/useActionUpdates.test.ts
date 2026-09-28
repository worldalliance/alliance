import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  useAllActionUpdates,
  useRecentActionUpdates,
} from "./useActionUpdates";

let body: unknown;
let limits: (string | null)[] = [];

serveApi(
  routes({
    "GET /actions/updates": ({ request }) => {
      limits.push(new URL(request.url).searchParams.get("limit"));
      return Response.json(body);
    },
    "GET /actions/allUpdates": () => Response.json(body),
  }),
);

const actionUpdateHooks = [
  ["recent", () => useRecentActionUpdates(3)],
  ["all", useAllActionUpdates],
] as const;

it.each(actionUpdateHooks)(
  "loads the %s action updates",
  async (_, useHook) => {
    body = [];
    const { wrapper } = queryWrapper();

    const hook = renderHook(() => useHook(), { wrapper });

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toEqual([]);
  },
);

it("requests the recent action updates with the limit", async () => {
  body = [];
  limits = [];
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useRecentActionUpdates(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(limits).toEqual(["3"]);
});

it.each(actionUpdateHooks)(
  "fails on a %s action updates response that is not a list",
  async (_, useHook) => {
    body = { data: [] };
    const { wrapper } = queryWrapper();

    const hook = renderHook(() => useHook(), { wrapper });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.data).toBeUndefined();
  },
);
