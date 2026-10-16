import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMyCommunities } from "./useMyCommunities";

const failed = () =>
  Response.json({ message: "Internal server error" }, { status: 500 });
let myGroups: () => Response | Promise<Response> = failed;
let membershipWrite: () => Response = failed;

serveApi(
  routes({
    "GET /community/list/my": () => myGroups(),
    "POST /community/1/leave": () => membershipWrite(),
    "POST /community/1/join": () => membershipWrite(),
  }),
);

beforeEach(() => {
  myGroups = failed;
  membershipWrite = failed;
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
  client.setQueryData(queryKeys.myCommunities(), cached);

  const hook = renderHook(() => useMyCommunities(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.communities).toBe(cached);
  expect(hook.result.current.didFail).toBe(false);
});

const renderLoaded = async () => {
  myGroups = () => Response.json(cached);
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.publicCommunities(), []);
  const hook = renderHook(() => useMyCommunities(), { wrapper });
  await waitFor(() => expect(hook.result.current.communities).toEqual(cached));
  const invalidated = (queryKey: readonly unknown[]) =>
    client.getQueryState(queryKey)?.isInvalidated;
  return { hook, client, invalidated };
};

it("leaving a group refreshes the user's groups and the public groups", async () => {
  membershipWrite = () => Response.json({});
  const { hook, invalidated } = await renderLoaded();
  myGroups = () => Response.json([]);

  await act(() => hook.result.current.leaveCommunity(1));

  await waitFor(() => expect(hook.result.current.communities).toEqual([]));
  expect(invalidated(queryKeys.publicCommunities())).toBe(true);
});

it("a left group stays gone when the groups refetch fails", async () => {
  membershipWrite = () => Response.json({});
  const { hook } = await renderLoaded();
  myGroups = failed;

  await act(() => hook.result.current.leaveCommunity(1));

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.communities).toEqual([]);
});

it("joining a public group resolves once the user's groups are refetched", async () => {
  const joined = { id: 2, name: "Public group", users: [] };
  membershipWrite = () => Response.json(joined);
  const { hook, client, invalidated } = await renderLoaded();
  const refetch = Promise.withResolvers<Response>();
  myGroups = () => refetch.promise;
  let result: unknown;

  const join = hook.result.current
    .joinPublicCommunity(1)
    .then((joinedGroup) => (result = joinedGroup));
  await waitFor(() =>
    expect(invalidated(queryKeys.publicCommunities())).toBe(true),
  );
  expect(result).toBeUndefined();
  await act(async () => {
    refetch.resolve(Response.json([joined]));
    await join;
  });

  expect(result).toEqual(joined);
  expect(client.getQueryData(queryKeys.myCommunities())).toEqual([joined]);
});

it.each(["leaveCommunity", "joinPublicCommunity"] as const)(
  "%s throws and refreshes nothing when refused",
  async (write) => {
    membershipWrite = () =>
      Response.json({ message: "Refused", statusCode: 400 }, { status: 400 });
    const { hook, invalidated } = await renderLoaded();

    const failure = hook.result.current[write](1).catch((e: unknown) => e);

    expect(await failure).toMatchObject({ statusCode: 400 });
    expect(invalidated(queryKeys.myCommunities())).toBe(false);
    expect(invalidated(queryKeys.publicCommunities())).toBe(false);
  },
);
