import {
  CommentDto,
  CommentParentObject,
  forumFindCommentsForAction,
  forumFindCommentsForActivity,
  forumFindCommentsForPost,
} from "@alliance/shared/client";
import { useCallback, useEffect, useState } from "react";

type ThreadFetcher = (id: string) => Promise<{ data?: CommentDto[] }>;

const THREAD_FETCHERS: Record<CommentParentObject, ThreadFetcher> = {
  post: (id) => forumFindCommentsForPost({ path: { id } }),
  activity: (id) => forumFindCommentsForActivity({ path: { id } }),
  action: (id) => forumFindCommentsForAction({ path: { id } }),
};

interface UseLoadCommentsInput {
  objectId: number;
  type: CommentParentObject;
  initialComments?: CommentDto[];
}

// The thread lives here rather than in the query cache. A card seeded from a
// feed and the screen sitting over it show the same thread from different
// sources, and one cache entry between them would let whichever wrote last
// take comments off the other.
export function useLoadComments({
  objectId,
  type,
  initialComments,
}: UseLoadCommentsInput) {
  const [comments, setThread] = useState<CommentDto[] | null>(
    initialComments ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const setComments = useCallback(
    (update: (prev: CommentDto[]) => CommentDto[]) =>
      setThread((prev) => (prev ? update(prev) : prev)),
    [],
  );

  const fetchComments = useCallback(async () => {
    const { data } = await THREAD_FETCHERS[type](objectId.toString());
    setThread(data ?? null);
  }, [objectId, type]);

  useEffect(() => {
    if (initialComments) {
      setThread(initialComments);
      return;
    }
    fetchComments();
  }, [initialComments, fetchComments]);

  return {
    comments,
    setComments,
    error,
    setError,
    fetchComments,
  };
}
