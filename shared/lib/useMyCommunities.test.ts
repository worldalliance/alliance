import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMyCommunities } from "./useMyCommunities";

const failed = () =>
  Response.json({ message: "Internal server error" }, { status: 500 });
let myGroups: () => Response = failed;

serveApi(routes({ "GET /community/list/my": () => myGroups() }));

beforeEach(() => {
  myGroups = failed;
});

const cached = [{ id: 1, name: "Group", users: [] }];

it("selects a community on the render its communities arrive", async () => {
  myGroups = () => Response.json(cached);
  const { wrapper } = queryWrapper();
  const renders: { isLoading: boolean; selected: boolean }[] = [];

  renderHook(
    () => {
      const hook = useMyCommunities();
      renders.push({
        isLoading: hook.isLoading,
        selected: hook.selectedCommunity !== null,
      });
      return hook;
    },
    { wrapper },
  );

  await waitFor(() => expect(renders.at(-1)?.isLoading).toBe(false));
  expect(renders).not.toContainEqual({
    isLoading: false,
    selected: false,
  });
});

it("a failed communities fetch reports an error", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useMyCommunities(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.communities).toEqual([]);
  expect(hook.result.current.didFail).toBe(true);
});

it("a failed communities refetch keeps the communities it had", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(["communityGetMyCommunities"], cached);

  const hook = renderHook(() => useMyCommunities(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.communities).toBe(cached);
  expect(hook.result.current.didFail).toBe(false);
});
