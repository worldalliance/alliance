import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  forumCreatePost,
  forumFindOnePost,
  forumLikePost,
  forumRemovePost,
  forumUnlikePost,
  forumUpdatePost,
  type CreatePostDto,
  type UpdatePostDto,
} from "../client";
import { forumPostStore, selectPost } from "./forumPostStore";
import { queryKeys } from "./queryKeys";
import { sendLike, withLike } from "./sendLike";
import { currentSession } from "./sessionStores";
import { invalidateForumPostLists } from "./useForumPosts";
import { useStoreState } from "./useStoreState";

/** One forum post and its writes. An undefined `postId` fetches nothing, for
 * the create form; `update` and `remove` throw then. `refetchOnMount:
 * "always"` makes `isFetchedAfterMount` turn true whatever the client's
 * staleTime. */
export function useForumPost(
  postId: string | undefined,
  {
    userId,
    refetchOnMount,
  }: { userId?: number; refetchOnMount?: "always" } = {},
) {
  const queryClient = useQueryClient();
  const store = forumPostStore(queryClient);
  const state = useStoreState(forumPostStore);
  const select = useCallback(
    (id: number | null) => (id === null ? null : selectPost(state, id)),
    [state],
  );

  const {
    data: post = null,
    isLoading,
    isFetchedAfterMount,
    error,
  } = useQuery({
    queryKey: queryKeys.forumPost(postId),
    queryFn: postId
      ? async ({ signal }) => {
          const session = currentSession(queryClient);
          const [loaded] = await store.load({
            carries: [],
            signal,
            fetch: () =>
              forumFindOnePost({ path: { id: postId }, signal }).then((res) => {
                if (res.error && res.response.status !== 404) throw res.error;
                return res.data ? [res.data] : [];
              }),
          });
          if (!loaded) store.removed({ session, postId: Number(postId) });
          return loaded?.id ?? null;
        }
      : skipToken,
    placeholderData: () =>
      store.getPost(Number(postId)) ? Number(postId) : undefined,
    refetchOnMount,
    select,
  });

  const handleLike = useCallback(async () => {
    if (!post || !userId) return;
    const { id } = post;
    try {
      await sendLike({
        store,
        session: currentSession(queryClient),
        target: `post:${id}`,
        liked: !post.likedByMe,
        change: (liked) => (candidate) =>
          candidate.id === id
            ? withLike(candidate, { liked, countKey: "likeCount" })
            : undefined,
        send: (liked) =>
          (liked ? forumLikePost : forumUnlikePost)({
            path: { id },
            throwOnError: true,
          }),
      });
    } finally {
      // The like answers with nothing, so the facepile comes from a reload.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.forumPost(postId),
        exact: true,
      });
    }
  }, [post, userId, store, queryClient, postId]);

  // A created post stays out of the store: the create response lacks the
  // action and tags the post page shows, so that page loads it.
  const { mutateAsync: create } = useMutation({
    mutationFn: (body: CreatePostDto) =>
      forumCreatePost({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: () => {
      void invalidateForumPostLists(queryClient);
    },
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: async (body: UpdatePostDto) => {
      if (!postId) throw new Error("No post to update");
      const session = currentSession(queryClient);
      const { data: saved } = await forumUpdatePost({
        path: { id: Number(postId) },
        body,
        throwOnError: true,
      });
      store.saved({ session, post: saved });
      return saved;
    },
  });

  const { mutateAsync: remove, isSuccess: removed } = useMutation({
    mutationFn: async () => {
      if (!postId) throw new Error("No post to remove");
      const session = currentSession(queryClient);
      await forumRemovePost({
        path: { id: Number(postId) },
        throwOnError: true,
      });
      store.removed({ session, postId: Number(postId) });
    },
  });

  return {
    post,
    isLoading,
    isFetchedAfterMount,
    error,
    handleLike,
    create,
    update,
    remove,
    removed,
  };
}
