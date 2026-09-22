import type { QueryKey } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi, type RouteTable } from "./testing/serveApi";
import {
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useMessageableUsersQuery,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
  useUserFriendStatusQuery,
  useUserFriendsQuery,
  useUserReceivedFriendRequestsQuery,
  useUserSentFriendRequestsQuery,
  userQueryKeys,
} from "./user";

const REFUSED_USER = 2;
const ALLOWED_USER = 3;

const notFound = () =>
  Response.json({ message: "No pending request found" }, { status: 404 });

const serverError = () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

const refuseRefusedUser = ({ params }: { params: Record<string, string> }) =>
  Object.values(params).includes(String(REFUSED_USER))
    ? notFound()
    : new Response(null, { status: 200 });

const friendRoutes: RouteTable = {
  "POST /user/friends/:targetUserId": refuseRefusedUser,
  "DELETE /user/friends/:targetUserId": refuseRefusedUser,
  "PATCH /user/friends/:requesterId/accept": refuseRefusedUser,
  "PATCH /user/friends/:requesterId/decline": refuseRefusedUser,
};

const friendMutations = [
  ["send", useSendFriendRequestMutation],
  ["accept", useAcceptFriendRequestMutation],
  ["decline", useDeclineFriendRequestMutation],
  ["remove", useRemoveFriendMutation],
] as const;

const requestLists: QueryKey[] = [
  userQueryKeys.receivedRequests(),
  userQueryKeys.sentRequests(),
];

const allLists: QueryKey[] = [
  userQueryKeys.friends(1),
  userQueryKeys.messageableUsers(),
  ...requestLists,
];

const failingFriendReads: RouteTable = {
  "GET /user/myfriendrelationship/:id": serverError,
  "GET /user/listfriends/:id": serverError,
  "GET /user/friends/requests/received": serverError,
  "GET /user/friends/requests/sent": serverError,
  "GET /user/listMessageableUsers": serverError,
};

const api = serveApi(routes(friendRoutes));

it.each(friendMutations)(
  "a refused %s refetches the friend status instead of setting it",
  async (_, useMutation) => {
    const { client, wrapper } = queryWrapper();
    const status = { status: "pending", didReceiveRequest: true };
    client.setQueryData(userQueryKeys.friendStatus(REFUSED_USER), status);

    const mutation = renderHook(() => useMutation(), { wrapper });

    await expect(
      mutation.result.current.mutateAsync(REFUSED_USER),
    ).rejects.toMatchObject({ message: "No pending request found" });
    expect(client.getQueryData(userQueryKeys.friendStatus(REFUSED_USER))).toBe(
      status,
    );
    expect(
      client.getQueryState(userQueryKeys.friendStatus(REFUSED_USER))
        ?.isInvalidated,
    ).toBe(true);
  },
);

it.each(friendMutations)(
  "a refused %s refetches every friend list",
  async (_, useMutation) => {
    const { client, wrapper } = queryWrapper();
    for (const key of allLists) client.setQueryData(key, []);

    const mutation = renderHook(() => useMutation(), { wrapper });

    await expect(
      mutation.result.current.mutateAsync(REFUSED_USER),
    ).rejects.toBeDefined();
    for (const key of allLists) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
  },
);

it.each(friendMutations)(
  "a refusal of %s through a client that throws on refusal refetches the friend status",
  async (_, useMutation) => {
    api.throwingOnRefusal(friendRoutes);
    const { client, wrapper } = queryWrapper();
    client.setQueryData(userQueryKeys.friendStatus(REFUSED_USER), {
      status: "pending",
      didReceiveRequest: true,
    });

    const mutation = renderHook(() => useMutation(), { wrapper });

    await expect(
      mutation.result.current.mutateAsync(REFUSED_USER),
    ).rejects.toMatchObject({ message: "No pending request found" });
    expect(
      client.getQueryState(userQueryKeys.friendStatus(REFUSED_USER))
        ?.isInvalidated,
    ).toBe(true);
  },
);

it.each([
  [
    "send",
    useSendFriendRequestMutation,
    { status: "pending", didReceiveRequest: false },
    allLists,
    true,
  ],
  [
    "accept",
    useAcceptFriendRequestMutation,
    { status: "accepted", didReceiveRequest: false },
    allLists,
    false,
  ],
  [
    "decline",
    useDeclineFriendRequestMutation,
    { status: "none", didReceiveRequest: false },
    requestLists,
    false,
  ],
  [
    "remove",
    useRemoveFriendMutation,
    { status: "none", didReceiveRequest: false },
    allLists,
    false,
  ],
] as const)(
  "a successful %s sets the friend status and refetches its lists",
  async (_, useMutation, status, lists, refetchesStatus) => {
    const { client, wrapper } = queryWrapper();
    for (const key of allLists) client.setQueryData(key, []);

    const mutation = renderHook(() => useMutation(), { wrapper });

    await mutation.result.current.mutateAsync(ALLOWED_USER);
    expect(
      client.getQueryData(userQueryKeys.friendStatus(ALLOWED_USER)),
    ).toEqual(status);
    expect(
      client.getQueryState(userQueryKeys.friendStatus(ALLOWED_USER))
        ?.isInvalidated,
    ).toBe(refetchesStatus);
    for (const key of allLists) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(
        lists.includes(key),
      );
    }
  },
);

const cachedFriends = [{ id: 4, displayName: "Ada" }];
const cachedStatus = { status: "accepted", didReceiveRequest: false };

const friendQueries = [
  [
    "friend status",
    () => useUserFriendStatusQuery(ALLOWED_USER),
    userQueryKeys.friendStatus(ALLOWED_USER),
    cachedStatus,
  ],
  [
    "friends",
    () => useUserFriendsQuery(ALLOWED_USER),
    userQueryKeys.friends(ALLOWED_USER),
    cachedFriends,
  ],
  [
    "received requests",
    () => useUserReceivedFriendRequestsQuery(),
    userQueryKeys.receivedRequests(),
    cachedFriends,
  ],
  [
    "sent requests",
    () => useUserSentFriendRequestsQuery(),
    userQueryKeys.sentRequests(),
    cachedFriends,
  ],
  [
    "messageable users",
    () => useMessageableUsersQuery(),
    userQueryKeys.messageableUsers(),
    cachedFriends,
  ],
] as const;

const servedFriendReads: RouteTable = {
  "GET /user/myfriendrelationship/:id": () => Response.json(cachedStatus),
  "GET /user/listfriends/:id": () => Response.json(cachedFriends),
  "GET /user/friends/requests/received": () => Response.json(cachedFriends),
  "GET /user/friends/requests/sent": () => Response.json(cachedFriends),
  "GET /user/listMessageableUsers": () => Response.json(cachedFriends),
};

it.each(friendQueries)(
  "a %s fetch returns the body the server sent",
  async (_, useQuery, __, body) => {
    api.alsoServing(servedFriendReads);
    const { wrapper } = queryWrapper();

    const query = renderHook(() => useQuery(), { wrapper });

    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));
    expect(query.result.current.data).toEqual(body);
  },
);

it.each(friendQueries)(
  "a failed %s fetch errors instead of caching empty data",
  async (_, useQuery) => {
    api.alsoServing(failingFriendReads);
    const { wrapper } = queryWrapper();

    const query = renderHook(() => useQuery(), { wrapper });

    await waitFor(() => expect(query.result.current.isError).toBe(true));
    expect(query.result.current.data).toBeUndefined();
  },
);

it.each(friendQueries)(
  "a failed %s refetch keeps the data it had",
  async (_, useQuery, key, cached) => {
    api.alsoServing(failingFriendReads);
    const { client, wrapper } = queryWrapper();
    client.setQueryData(key, cached);

    const query = renderHook(() => useQuery(), { wrapper });

    await waitFor(() => expect(query.result.current.isError).toBe(true));
    expect(query.result.current.data).toBe(cached);
  },
);

it("hands the caller the error body the server sent, which is no Error", async () => {
  api.alsoServing(failingFriendReads);
  const { wrapper } = queryWrapper();

  const query = renderHook(() => useUserFriendsQuery(ALLOWED_USER), {
    wrapper,
  });

  await waitFor(() => expect(query.result.current.isError).toBe(true));
  expect(query.result.current.error).toEqual({
    message: "Internal server error",
    statusCode: 500,
  });
  expect(query.result.current.error).not.toBeInstanceOf(Error);
});

it("a successful decline settles once the received requests have reloaded", async () => {
  let received = [{ id: ALLOWED_USER, displayName: "Grace" }];
  api.alsoServing({
    "GET /user/friends/requests/received": () => Response.json(received),
    "PATCH /user/friends/:requesterId/decline": () => {
      received = [];
      return new Response(null, { status: 200 });
    },
  });
  const { client, wrapper } = queryWrapper();
  const hooks = renderHook(
    () => ({
      list: useUserReceivedFriendRequestsQuery(),
      decline: useDeclineFriendRequestMutation(),
    }),
    { wrapper },
  );
  await waitFor(() => expect(hooks.result.current.list.data).toHaveLength(1));

  await hooks.result.current.decline.mutateAsync(ALLOWED_USER);
  expect(client.getQueryData(userQueryKeys.receivedRequests())).toEqual([]);
});
