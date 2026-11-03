import { act, renderHook, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { HomeFeedItemDto } from "../client";
import { makeActivity } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import useActivities, { ActivityList } from "./useActivities";
import useHomeFeed from "./useHomeFeed";
import useUserFeed from "./useUserFeed";

const items = (): HomeFeedItemDto[] => [
  {
    type: "activity",
    date: "2026-01-02T00:00:00.000Z",
    activity: makeActivity({ id: 1 }),
  },
];

let homeFeed: () => Promise<Response>;
let profileFeed: () => Promise<Response>;
let community: () => Promise<Response>;

serveApi(
  routes({
    "GET /actions/homeFeed": () => homeFeed(),
    "GET /actions/userFeed/:id": () => profileFeed(),
    "GET /actions/communityActivity": () => community(),
  }),
);

beforeEach(() => {
  homeFeed = async () => Response.json(items());
  profileFeed = async () => Response.json(items());
  community = async () => Response.json([makeActivity({ id: 1 })]);
});

it("keeps a loaded list and feed when their refetch fails", async () => {
  const { client, wrapper } = queryWrapper();
  const hook = renderHook(
    () => ({
      home: useHomeFeed(),
      list: useActivities({ list: ActivityList.Community, objectId: 4 }),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.home.items).toHaveLength(1);
    expect(hook.result.current.list.activities).toHaveLength(1);
  });
  homeFeed = async () => new Response(null, { status: 500 });
  community = async () => new Response(null, { status: 500 });

  void client.refetchQueries({ queryKey: ["useHomeFeed"] });
  void hook.result.current.list.refresh();

  await waitFor(() =>
    expect(
      client
        .getQueryCache()
        .findAll({ type: "active" })
        .filter((query) => query.state.status === "error"),
    ).toHaveLength(2),
  );
  expect(hook.result.current.home.items).toHaveLength(1);
  expect(hook.result.current.list.activities).toHaveLength(1);
});

it("keeps a loaded profile feed when its refetch fails", async () => {
  const { client, wrapper } = queryWrapper();
  const profile = renderHook(() => useUserFeed({ userId: 3 }), { wrapper });
  await waitFor(() => expect(profile.result.current.items).toHaveLength(1));
  profileFeed = async () => new Response(null, { status: 500 });

  void client.refetchQueries({ queryKey: ["useUserFeed"] });

  await waitFor(() =>
    expect(
      client
        .getQueryCache()
        .findAll({ queryKey: ["useUserFeed"] })
        .map((query) => query.state.status),
    ).toEqual(["error"]),
  );
  expect(profile.result.current.items).toHaveLength(1);
});

it("stops a feed's pagination after a failed page until a refetch", async () => {
  const { client, wrapper } = queryWrapper();
  const home = renderHook(() => useHomeFeed({ limit: 1 }), { wrapper });
  await waitFor(() => expect(home.result.current.items).toHaveLength(1));
  expect(home.result.current.hasNextPage).toBe(true);
  homeFeed = async () => new Response(null, { status: 500 });

  await act(() => home.result.current.fetchNextPage());

  await waitFor(() =>
    expect(home.result.current.isFetchingNextPage).toBe(false),
  );
  expect(home.result.current.items).toHaveLength(1);
  expect(home.result.current.hasNextPage).toBe(false);

  homeFeed = async () => Response.json(items());
  await act(() => client.refetchQueries({ queryKey: ["useHomeFeed"] }));
  await waitFor(() => expect(home.result.current.hasNextPage).toBe(true));
});

it("sends a failed page once to a caller that pulls whenever nothing loads", async () => {
  const { wrapper } = queryWrapper();
  let requests = 0;
  renderHook(
    () => {
      const home = useHomeFeed({ limit: 1 });
      const { hasNextPage, isFetchingNextPage, loading, fetchNextPage } = home;
      useEffect(() => {
        if (!loading && hasNextPage && !isFetchingNextPage)
          void fetchNextPage();
      }, [loading, hasNextPage, isFetchingNextPage, fetchNextPage]);
      return home;
    },
    { wrapper },
  );
  homeFeed = async () => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return requests === 1
      ? Response.json(items())
      : new Response(null, { status: 403 });
  };

  await waitFor(() => expect(requests).toBe(2));
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(requests).toBe(2);
});

it("stops a cursor list's pagination after a failed page", async () => {
  const { wrapper } = queryWrapper();
  const list = renderHook(
    () =>
      useActivities({ list: ActivityList.Community, objectId: 4, limit: 1 }),
    { wrapper },
  );
  await waitFor(() => expect(list.result.current.activities).toHaveLength(1));
  expect(list.result.current.hasNextPage).toBe(true);
  community = async () => new Response(null, { status: 500 });

  await act(async () => {
    await list.result.current.fetchNextPage();
  });

  await waitFor(() =>
    expect(list.result.current.isFetchingNextPage).toBe(false),
  );
  expect(list.result.current.activities).toHaveLength(1);
  expect(list.result.current.hasNextPage).toBe(false);
});
