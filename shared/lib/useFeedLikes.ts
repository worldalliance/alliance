import { R } from "@alliance/common/result";
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
import { currentSession } from "./sessionStores";

/** Idempotent, so it can replay over a load that already reads it. */
const withLike = <T extends { likedByMe?: boolean; likesCount: number }>(
  item: T,
  liked: boolean,
): T =>
  Boolean(item.likedByMe) === liked
    ? item
    : {
        ...item,
        likedByMe: liked,
        likesCount: Math.max(0, item.likesCount + (liked ? 1 : -1)),
      };

/** Shows the like at once and settles on the server's answer. A refusal
 * rejects. The answer applies only if no later like or unlike of the same
 * target has started since; a refusal of the latest returns the target, once
 * every one is answered, to the state the server last confirmed. */
async function sendLike<S>(params: {
  store: ReturnType<typeof activityStore>;
  session: number;
  target: string;
  liked: boolean;
  change: (liked: boolean) => ActivityChange;
  send: (liked: boolean) => Promise<S>;
  confirmed?: (response: S) => ActivityChange;
}) {
  const { store, session, liked, change } = params;
  const turn = store.takeTurn(params.target, !liked);
  const request = params.send(liked);
  store.write({ session, change: change(liked), confirmation: request });
  const sent = await R.fromPromise(request);
  const restore = turn.answer(sent.ok ? liked : undefined);
  if (restore !== undefined) store.write({ session, change: change(restore) });
  if (!sent.ok) throw sent.error;
  if (turn.latest() && params.confirmed)
    store.write({ session, change: params.confirmed(sent.value) });
}

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
        change: (liked) => patch((a) => withLike(a, liked)),
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
              ? withLike(candidate, liked)
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
