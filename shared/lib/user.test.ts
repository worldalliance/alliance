import type { QueryKey } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi, type RouteTable } from "./testing/serveApi";
import {
  friendMutationErrorMessage,
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useMessageableUsersQuery,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
  useUserForumCommentsQuery,
  useUserForumPostsQuery,
  useUserFriendStatusQuery,
  useUserFriendsQuery,
  useUserReceivedFriendRequestsQuery,
  useUserSentFriendRequestsQuery,
  userQueryKeys,
} from "./user";

const REFUSED_USER = 2;
const ALLOWED_USER = 3;
const REQUESTING_USER = 4;

const notFound = () =>
  Response.json({ message: "No pending request found" }, { status: 404 });

const serverError = () =>
  Response.json({ message: "Internal server error" }, { status: 500 });

const refuseRefusedUser = ({ params }: { params: Record<string, string> }) =>
  Object.values(params).includes(String(REFUSED_USER))
    ? notFound()
    : new Response(null, { status: 200 });

const sendFriendRequest = ({ params }: { params: Record<string, string> }) => {
  switch (Number(params.targetUserId)) {
    case REFUSED_USER:
      return notFound();
    case REQUESTING_USER:
      return Response.json({ status: "accepted", didReceiveRequest: false });
    default:
      return Response.json({ status: "pending", didReceiveRequest: false });
  }
};

const friendRoutes: RouteTable = {
  "POST /user/friends/:targetUserId": sendFriendRequest,
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

const failingReads: RouteTable = {
  "GET /user/myfriendrelationship/:id": serverError,
  "GET /user/listfriends/:id": serverError,
  "GET /user/friends/requests/received": serverError,
  "GET /user/friends/requests/sent": serverError,
  "GET /user/listMessageableUsers": serverError,
  "GET /forum/posts/user/:id": serverError,
  "GET /forum/posts/user/:id/comments": serverError,
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
  ],
  [
    "accept",
    useAcceptFriendRequestMutation,
    { status: "accepted", didReceiveRequest: false },
    allLists,
  ],
  [
    "decline",
    useDeclineFriendRequestMutation,
    { status: "none", didReceiveRequest: false },
    requestLists,
  ],
  [
    "remove",
    useRemoveFriendMutation,
    { status: "none", didReceiveRequest: false },
    allLists,
  ],
] as const)(
  "a successful %s sets the friend status and refetches its lists",
  async (_, useMutation, status, lists) => {
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
    ).toBe(false);
    for (const key of allLists) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(
        lists.includes(key),
      );
    }
  },
);

it("a send that accepts their request sets the friend status to accepted", async () => {
  const { client, wrapper } = queryWrapper();

  const mutation = renderHook(() => useSendFriendRequestMutation(), {
    wrapper,
  });

  await mutation.result.current.mutateAsync(REQUESTING_USER);
  expect(
    client.getQueryData(userQueryKeys.friendStatus(REQUESTING_USER)),
  ).toEqual({ status: "accepted", didReceiveRequest: false });
});

it.each(friendMutations)(
  "a successful %s keeps its status over a status read begun before it",
  async (_, useMutation) => {
    const { client, wrapper } = queryWrapper();
    const staleRead = Promise.withResolvers<void>();
    api.alsoServing({
      "GET /user/myfriendrelationship/:id": async () => {
        await staleRead.promise;
        return Response.json({ status: "pending", didReceiveRequest: true });
      },
    });
    renderHook(() => useUserFriendStatusQuery(ALLOWED_USER), { wrapper });
    const mutation = renderHook(() => useMutation(), { wrapper });

    const status = await mutation.result.current.mutateAsync(ALLOWED_USER);
    staleRead.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      client.getQueryData(userQueryKeys.friendStatus(ALLOWED_USER)),
    ).toEqual(status);
  },
);

const cachedList = [{ id: 4, displayName: "Ada" }];
const cachedStatus = { status: "accepted", didReceiveRequest: false };

const erroringQueries = [
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
    cachedList,
  ],
  [
    "received requests",
    () => useUserReceivedFriendRequestsQuery(),
    userQueryKeys.receivedRequests(),
    cachedList,
  ],
  [
    "sent requests",
    () => useUserSentFriendRequestsQuery(),
    userQueryKeys.sentRequests(),
    cachedList,
  ],
  [
    "messageable users",
    () => useMessageableUsersQuery(),
    userQueryKeys.messageableUsers(),
    cachedList,
  ],
  [
    "forum posts",
    () => useUserForumPostsQuery(ALLOWED_USER),
    userQueryKeys.forumPosts(ALLOWED_USER),
    cachedList,
  ],
  [
    "forum comments",
    () => useUserForumCommentsQuery(ALLOWED_USER),
    userQueryKeys.forumComments(ALLOWED_USER),
    cachedList,
  ],
] as const;

const servedReads: RouteTable = {
  "GET /user/myfriendrelationship/:id": () => Response.json(cachedStatus),
  "GET /user/listfriends/:id": () => Response.json(cachedList),
  "GET /user/friends/requests/received": () => Response.json(cachedList),
  "GET /user/friends/requests/sent": () => Response.json(cachedList),
  "GET /user/listMessageableUsers": () => Response.json(cachedList),
  "GET /forum/posts/user/:id": () => Response.json(cachedList),
  "GET /forum/posts/user/:id/comments": () => Response.json(cachedList),
};

it.each(erroringQueries)(
  "a %s fetch returns the body the server sent",
  async (_, useQuery, __, body) => {
    api.alsoServing(servedReads);
    const { wrapper } = queryWrapper();

    const query = renderHook(() => useQuery(), { wrapper });

    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));
    expect(query.result.current.data).toEqual(body);
  },
);

it.each(erroringQueries)(
  "a failed %s fetch errors instead of caching empty data",
  async (_, useQuery) => {
    api.alsoServing(failingReads);
    const { wrapper } = queryWrapper();

    const query = renderHook(() => useQuery(), { wrapper });

    await waitFor(() => expect(query.result.current.isError).toBe(true));
    expect(query.result.current.data).toBeUndefined();
  },
);

it.each(erroringQueries)(
  "a failed %s refetch keeps the data it had",
  async (_, useQuery, key, cached) => {
    api.alsoServing(failingReads);
    const { client, wrapper } = queryWrapper();
    client.setQueryData(key, cached);

    const query = renderHook(() => useQuery(), { wrapper });

    await waitFor(() => expect(query.result.current.isError).toBe(true));
    expect(query.result.current.data).toBe(cached);
  },
);

it("hands the caller the error body the server sent, which is no Error", async () => {
  api.alsoServing(failingReads);
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

const declineAnswering = async (answer: () => Response) => {
  api.alsoServing({ "PATCH /user/friends/:requesterId/decline": answer });
  const { wrapper } = queryWrapper();
  const mutation = renderHook(() => useDeclineFriendRequestMutation(), {
    wrapper,
  });
  const error = await mutation.result.current
    .mutateAsync(ALLOWED_USER)
    .catch((thrown: unknown) => thrown);
  return friendMutationErrorMessage(error);
};

it("tells the user why the server refused a friend action", async () => {
  expect(await declineAnswering(notFound)).toBe("No pending request found");
});

it("keeps the server's own fault out of a friend action's message", async () => {
  expect(await declineAnswering(serverError)).toBe("Please try again.");
});

it("says the session went rather than repeating the server's word for it", async () => {
  expect(
    await declineAnswering(() =>
      Response.json({ message: "Unauthorized" }, { status: 401 }),
    ),
  ).toBe("Your session has expired. Sign in again.");
});

it("asks again after a friend action that never reached the server", async () => {
  expect(
    await declineAnswering(() => {
      throw new TypeError("Failed to fetch");
    }),
  ).toBe("Please try again.");
});
