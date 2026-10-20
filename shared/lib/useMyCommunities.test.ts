import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NEW_COMMUNITY_SETTINGS } from "./constants";
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
    "POST /community/create": () => membershipWrite(),
    "PATCH /community/1": () => membershipWrite(),
  }),
);

beforeEach(() => {
  myGroups = failed;
  membershipWrite = failed;
});

afterEach(() => onlineManager.setOnline(true));

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

const newGroup = {
  name: "New group",
  description: "",
  ...NEW_COMMUNITY_SETTINGS,
};

it("creating a group adds it at once and refreshes the user's groups and the public groups", async () => {
  const created = { id: 2, name: "New group", users: [] };
  membershipWrite = () => Response.json(created);
  const { hook, invalidated } = await renderLoaded();
  const refetch = Promise.withResolvers<Response>();
  myGroups = () => refetch.promise;

  await act(async () => {
    expect(await hook.result.current.createCommunity(newGroup)).toEqual(
      created,
    );
  });

  await waitFor(() =>
    expect(hook.result.current.communities).toEqual([...cached, created]),
  );
  expect(invalidated(queryKeys.myCommunities())).toBe(true);
  expect(invalidated(queryKeys.publicCommunities())).toBe(true);
  await act(async () => refetch.resolve(Response.json([created])));
  await waitFor(() =>
    expect(hook.result.current.communities).toEqual([created]),
  );
});

it("saving a group's settings puts the saved group in the cache", async () => {
  const saved = { ...cached[0], name: "Renamed" };
  membershipWrite = () => Response.json(saved);
  const { hook, invalidated } = await renderLoaded();

  await act(async () => {
    expect(
      await hook.result.current.saveCommunity({
        communityId: 1,
        body: { name: "Renamed" },
      }),
    ).toEqual(saved);
  });

  await waitFor(() => expect(hook.result.current.communities).toEqual([saved]));
  expect(invalidated(queryKeys.myCommunities())).toBe(false);
});

it.each([
  {
    write: "createCommunity",
    send: (hook: Hook) => hook.createCommunity(newGroup),
  },
  {
    write: "saveCommunity",
    send: (hook: Hook) =>
      hook.saveCommunity({ communityId: 1, body: { name: "Renamed" } }),
  },
])("$write fails at once offline", async ({ send }) => {
  const { hook } = await renderLoaded();
  onlineManager.setOnline(false);
  membershipWrite = () => {
    throw new TypeError("Network request failed");
  };

  const failure = send(hook.result.current).catch((e: unknown) => e);

  expect(await failure).toBeInstanceOf(TypeError);
});

type Hook = ReturnType<typeof useMyCommunities>;

it.each([
  {
    write: "createCommunity",
    send: (hook: Hook) => hook.createCommunity(newGroup),
  },
  { write: "leaveCommunity", send: (hook: Hook) => hook.leaveCommunity(1) },
  {
    write: "joinPublicCommunity",
    send: (hook: Hook) => hook.joinPublicCommunity(1),
  },
  {
    write: "saveCommunity",
    send: (hook: Hook) =>
      hook.saveCommunity({ communityId: 1, body: { name: "Renamed" } }),
  },
])("$write throws and changes nothing when refused", async ({ send }) => {
  membershipWrite = () =>
    Response.json({ message: "Refused", statusCode: 400 }, { status: 400 });
  const { hook, invalidated } = await renderLoaded();

  const failure = send(hook.result.current).catch((e: unknown) => e);

  expect(await failure).toMatchObject({ statusCode: 400 });
  expect(hook.result.current.communities).toEqual(cached);
  expect(invalidated(queryKeys.myCommunities())).toBe(false);
  expect(invalidated(queryKeys.publicCommunities())).toBe(false);
});
