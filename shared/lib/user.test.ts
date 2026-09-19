import type { QueryKey } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi, type RouteTable } from "./testing/serveApi";
import {
  useAcceptFriendRequestMutation,
  useDeclineFriendRequestMutation,
  useRemoveFriendMutation,
  useSendFriendRequestMutation,
  userQueryKeys,
} from "./user";

const REFUSED_USER = 2;
const ALLOWED_USER = 3;

const notFound = () =>
  Response.json({ message: "No pending request found" }, { status: 404 });

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
