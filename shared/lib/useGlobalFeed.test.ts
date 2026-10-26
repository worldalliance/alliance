import { act, renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import useGlobalFeed from "./useGlobalFeed";

let feedUp = false;
serveApi(
  routes({
    "GET /actions/globalFeed": () =>
      feedUp ? Response.json([]) : new Response(null, { status: 500 }),
  }),
);

it("reports a failed load instead of an empty feed, and recovers on retry", async () => {
  feedUp = false;
  const { result } = renderHook(() => useGlobalFeed({ limit: 10 }), {
    wrapper: queryWrapper().wrapper,
  });

  await waitFor(() => expect(result.current.failure).not.toBeNull());
  expect(result.current.loading).toBe(false);

  feedUp = true;
  act(() => result.current.failure?.onRetry());
  await waitFor(() => expect(result.current.failure).toBeNull());
  expect(result.current.items).toEqual([]);
});
