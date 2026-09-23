import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMyCommunities } from "./useMyCommunities";

serveApi(
  routes({
    "GET /community/list/my": () =>
      Response.json({ message: "Internal server error" }, { status: 500 }),
  }),
);

const cached = [{ id: 1, name: "Group", users: [] }];

it("a failed communities fetch reports an error", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useMyCommunities(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.communities).toEqual([]);
});

it("a failed communities refetch keeps the communities it had", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(["communityGetMyCommunities"], cached);

  const hook = renderHook(() => useMyCommunities(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.communities).toBe(cached);
});
