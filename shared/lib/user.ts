import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  FriendStatusDto,
  PostDto,
  ProfileDto,
  UpdateProfileDto,
  UserCommentDto,
  forumFindCommentsByUser,
  forumFindPostsByUser,
  userAcceptFriendRequest,
  userDeclineFriendRequest,
  userFindOne,
  userListFriends,
  userListMessageableUsers,
  userListReceivedRequests,
  userListSentRequests,
  userMyFriendRelationship,
  userRemoveFriend,
  userRequestFriend,
  userUpdate,
} from "../client";
import { queryKeys } from "./queryKeys";

export const userQueryKeys = {
  profile: (userId: number) => ["user", userId, "profile"] as const,
  friendStatus: (userId: number) => ["user", userId, "friendStatus"] as const,
  forumPosts: (userId: number) => ["user", userId, "forumPosts"] as const,
  forumComments: (userId: number) => ["user", userId, "forumComments"] as const,
  allFriends: () => ["user", "friends"] as const,
  friends: (userId: number | undefined) =>
    [...userQueryKeys.allFriends(), userId] as const,
  receivedRequests: () => ["user", "friendRequests", "received"] as const,
  sentRequests: () => ["user", "friendRequests", "sent"] as const,
  messageableUsers: () => ["user", "messageableUsers"] as const,
};

export type ForumActivityItem =
  | {
      type: "post";
      createdAt: string;
      post: PostDto;
    }
  | {
      type: "comment";
      createdAt: string;
      comment: UserCommentDto;
    };

export const buildForumActivityItems = (
  posts: PostDto[] = [],
  comments: UserCommentDto[] = [],
): ForumActivityItem[] => {
  const postItems: ForumActivityItem[] = posts.map((post) => ({
    type: "post",
    createdAt: post.createdAt,
    post,
  }));

  const commentItems: ForumActivityItem[] = comments.map((comment) => ({
    type: "comment",
    createdAt: comment.createdAt,
    comment,
  }));

  return [...postItems, ...commentItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
};

const defaultQueryEnabled = (
  userId: number | undefined,
  enabled: boolean | undefined,
) => Boolean(userId) && (enabled ?? true);

type UserProfileQueryOptions = Omit<
  UseQueryOptions<ProfileDto | null>,
  "queryKey" | "queryFn" | "enabled"
> & { enabled?: boolean };

type UserPostsQueryOptions = Omit<
  UseQueryOptions<PostDto[]>,
  "queryKey" | "queryFn" | "enabled"
> & { enabled?: boolean };

type UserCommentsQueryOptions = Omit<
  UseQueryOptions<UserCommentDto[]>,
  "queryKey" | "queryFn" | "enabled"
> & { enabled?: boolean };

type FriendStatusQueryOptions = Omit<
  UseQueryOptions<FriendStatusDto | null, unknown>,
  "queryKey" | "queryFn" | "enabled"
> & { enabled?: boolean };

type FriendsQueryOptions<TData> = Omit<
  UseQueryOptions<ProfileDto[], unknown, TData>,
  "queryKey" | "queryFn" | "enabled"
> & { enabled?: boolean };

type FriendRequestsQueryOptions = Omit<
  UseQueryOptions<ProfileDto[], unknown>,
  "queryKey" | "queryFn"
>;

export const useUserProfileQuery = (
  userId: number,
  options?: UserProfileQueryOptions,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.profile(userId),
    queryFn: async () => {
      if (!userId) return null;
      const response = await userFindOne({ path: { id: userId } });
      if (response.error) {
        const status = response.response?.status;
        if (status && status >= 500) {
          throw response.error;
        }
        return null;
      }
      return response.data ?? null;
    },
    enabled: defaultQueryEnabled(userId, options?.enabled),
  });

export const useUserFriendStatusQuery = (
  userId: number,
  options?: FriendStatusQueryOptions,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.friendStatus(userId),
    queryFn: async () => {
      if (!userId) return null;
      const response = await userMyFriendRelationship({
        path: { id: userId },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: defaultQueryEnabled(userId, options?.enabled),
  });

export const useUserForumPostsQuery = (
  userId: number,
  options?: UserPostsQueryOptions,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.forumPosts(userId),
    queryFn: async () => {
      if (!userId) return [];
      const response = await forumFindPostsByUser({ path: { id: userId } });
      return response.data ?? [];
    },
    enabled: defaultQueryEnabled(userId, options?.enabled),
  });

export const useUserForumCommentsQuery = (
  userId: number,
  options?: UserCommentsQueryOptions,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.forumComments(userId),
    queryFn: async () => {
      if (!userId) return [];
      const response = await forumFindCommentsByUser({
        path: { id: userId },
      });
      return response.data ?? [];
    },
    enabled: defaultQueryEnabled(userId, options?.enabled),
  });

export const selectFriendIds = (friends: ProfileDto[]) =>
  friends.map((friend) => friend.id);

export const useUserFriendsQuery = <TData = ProfileDto[]>(
  userId: number | undefined,
  options?: FriendsQueryOptions<TData>,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.friends(userId),
    queryFn: async () => {
      if (!userId) return [];
      const response = await userListFriends({
        path: { id: userId },
        throwOnError: true,
      });
      return response.data;
    },
    enabled: defaultQueryEnabled(userId, options?.enabled),
  });

export const useUserReceivedFriendRequestsQuery = (
  options?: FriendRequestsQueryOptions,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.receivedRequests(),
    queryFn: async () => {
      const response = await userListReceivedRequests({ throwOnError: true });
      return response.data;
    },
  });

export const useUserSentFriendRequestsQuery = (
  options?: FriendRequestsQueryOptions,
) =>
  useQuery({
    ...options,
    queryKey: userQueryKeys.sentRequests(),
    queryFn: async () => {
      const response = await userListSentRequests({ throwOnError: true });
      return response.data;
    },
  });

type MessageableUsersQueryOptions = Omit<
  UseQueryOptions<ProfileDto[], unknown>,
  "queryKey" | "queryFn"
>;

const EMPTY_MESSAGEABLE_IDS: ReadonlySet<number> = new Set();

export const useMessageableUsersQuery = (
  options?: MessageableUsersQueryOptions,
) => {
  const query = useQuery({
    ...options,
    queryKey: userQueryKeys.messageableUsers(),
    queryFn: async () => {
      const response = await userListMessageableUsers({ throwOnError: true });
      return response.data;
    },
  });
  const ids = useMemo<ReadonlySet<number>>(
    () =>
      query.data ? new Set(query.data.map((u) => u.id)) : EMPTY_MESSAGEABLE_IDS,
    [query.data],
  );
  return { ...query, ids };
};

type FriendRequestMutationOptions = UseMutationOptions<void, unknown, number>;

type UpdateProfileMutationOptions = UseMutationOptions<
  ProfileDto | null,
  Error,
  UpdateProfileDto
>;

const invalidateFriendRequests = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: userQueryKeys.receivedRequests(),
    }),
    queryClient.invalidateQueries({
      queryKey: userQueryKeys.sentRequests(),
    }),
  ]);

const invalidateFriendships = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: userQueryKeys.allFriends() }),
    queryClient.invalidateQueries({
      queryKey: userQueryKeys.messageableUsers(),
    }),
    invalidateFriendRequests(queryClient),
  ]);

const resyncFriend = (queryClient: QueryClient, userId: number) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: userQueryKeys.friendStatus(userId),
    }),
    invalidateFriendships(queryClient),
  ]);

const useFriendMutation = (
  params: {
    call: (userId: number) => Promise<unknown>;
    statusOnSuccess: FriendStatusDto;
    invalidateOnSuccess: (
      queryClient: QueryClient,
      userId: number,
    ) => Promise<unknown>;
  },
  options?: FriendRequestMutationOptions,
) => {
  const { call, statusOnSuccess, invalidateOnSuccess } = params;
  const queryClient = useQueryClient();
  return useMutation<void, unknown, number>({
    mutationFn: async (userId) => {
      await call(userId);
    },
    // Stays pending until the refetched lists land, so a caller that disables
    // on isPending keeps an answered row locked until it leaves the list.
    onSuccess: async (data, userId, onMutateResult, context) => {
      queryClient.setQueryData(
        userQueryKeys.friendStatus(userId),
        statusOnSuccess,
      );
      const refetched = invalidateOnSuccess(queryClient, userId);
      options?.onSuccess?.(data, userId, onMutateResult, context);
      await refetched;
    },
    onError: (error, userId, onMutateResult, context) => {
      void resyncFriend(queryClient, userId);
      options?.onError?.(error, userId, onMutateResult, context);
    },
  });
};

export const useSendFriendRequestMutation = (
  options?: FriendRequestMutationOptions,
) =>
  useFriendMutation(
    {
      call: (targetUserId) =>
        userRequestFriend({ path: { targetUserId }, throwOnError: true }),
      statusOnSuccess: { status: "pending", didReceiveRequest: false },
      // Sending back to someone whose request is pending accepts theirs.
      invalidateOnSuccess: resyncFriend,
    },
    options,
  );

export const useAcceptFriendRequestMutation = (
  options?: FriendRequestMutationOptions,
) =>
  useFriendMutation(
    {
      call: (requesterId) =>
        userAcceptFriendRequest({ path: { requesterId }, throwOnError: true }),
      statusOnSuccess: { status: "accepted", didReceiveRequest: false },
      invalidateOnSuccess: invalidateFriendships,
    },
    options,
  );

export const useDeclineFriendRequestMutation = (
  options?: FriendRequestMutationOptions,
) =>
  useFriendMutation(
    {
      call: (requesterId) =>
        userDeclineFriendRequest({ path: { requesterId }, throwOnError: true }),
      statusOnSuccess: { status: "none", didReceiveRequest: false },
      invalidateOnSuccess: invalidateFriendRequests,
    },
    options,
  );

export const useRemoveFriendMutation = (
  options?: FriendRequestMutationOptions,
) =>
  useFriendMutation(
    {
      call: (targetUserId) =>
        userRemoveFriend({ path: { targetUserId }, throwOnError: true }),
      statusOnSuccess: { status: "none", didReceiveRequest: false },
      invalidateOnSuccess: invalidateFriendships,
    },
    options,
  );

export const useUpdateProfileMutation = (
  userId: number | undefined,
  options?: UpdateProfileMutationOptions,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateProfileDto) => {
      const response = await userUpdate({ body: payload });
      if (response.error) {
        throw response.error;
      }
      return response.data ?? null;
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      const targetId = data?.id ?? userId;
      if (targetId) {
        queryClient.setQueryData(userQueryKeys.profile(targetId), data);
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.myVisibilityContext(),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
};
