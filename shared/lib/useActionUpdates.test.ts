import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import {
  useAllActionUpdates,
  useRecentActionUpdates,
} from "./useActionUpdates";

let limits: (string | null)[] = [];

serveApi(
  routes({
    "GET /actions/updates": ({ request }) => {
      limits.push(new URL(request.url).searchParams.get("limit"));
      return Response.json([]);
    },
    "GET /actions/allUpdates": () => Response.json([]),
  }),
);

it("loads the recent action updates", async () => {
  limits = [];
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useRecentActionUpdates(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([]);
  expect(limits).toEqual(["3"]);
});

it("loads all action updates", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useAllActionUpdates(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([]);
});
