import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useRecentActionUpdates } from "./useActionUpdates";

let body: unknown;
let limits: (string | null)[] = [];

serveApi(
  routes({
    "GET /actions/updates": ({ request }) => {
      limits.push(new URL(request.url).searchParams.get("limit"));
      return Response.json(body);
    },
  }),
);

it("loads the recent action updates", async () => {
  body = [];
  limits = [];
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useRecentActionUpdates(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([]);
  expect(limits).toEqual(["3"]);
});

it("fails on a recent action updates response that is not a list", async () => {
  body = { data: [] };
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useRecentActionUpdates(3), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.data).toBeUndefined();
});
