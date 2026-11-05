import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  type ActionActivityDto,
  actionFeedLikeActivity,
  actionFeedUnlikeActivity,
  forumLikeComment,
  forumUnlikeComment,
} from "../client";
import { type ActivityChange, activityStore } from "./activityStore";
import { sendLike, withLike } from "./sendLike";
import { currentSession } from "./sessionStores";

export function useLikeActivity() {
  const queryClient = useQueryClient();
  return useCallback(
    async (activityId: number) => {
      const store = activityStore(queryClient);
      const activity = store.getActivity(activityId);
      if (!activity) return;
      const patch = (
        update: (activity: ActionActivityDto) => ActionActivityDto,
      ): ActivityChange => ({
        activity: (candidate) =>
          candidate.id === activityId ? update(candidate) : undefined,
      });
      await sendLike({
        store,
        session: currentSession(queryClient),
        target: `activity:${activityId}`,
        liked: !activity.likedByMe,
        change: (liked) =>
          patch((a) => withLike(a, { liked, countKey: "likesCount" })),
        send: (liked) =>
          (liked ? actionFeedLikeActivity : actionFeedUnlikeActivity)({
            path: { id: activityId },
            throwOnError: true,
          }),
        confirmed: ({ data: { likes, likesCount, likedByMe } }) =>
          patch((a) => ({ ...a, likes, likesCount, likedByMe })),
      });
    },
    [queryClient],
  );
}

export function useLikeForumComment() {
  const queryClient = useQueryClient();
  return useCallback(
    async (commentId: number) => {
      const store = activityStore(queryClient);
      const forumComment = store.getForumComment(commentId);
      if (!forumComment) return;
      await sendLike({
        store,
        session: currentSession(queryClient),
        target: `forumComment:${commentId}`,
        liked: !forumComment.likedByMe,
        change: (liked) => ({
          forumComment: (candidate) =>
            candidate.comment.id === commentId
              ? withLike(candidate, { liked, countKey: "likesCount" })
              : undefined,
        }),
        send: (liked) =>
          (liked ? forumLikeComment : forumUnlikeComment)({
            path: { id: commentId },
            throwOnError: true,
          }),
      });
    },
    [queryClient],
  );
}
