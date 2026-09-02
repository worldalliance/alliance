import { R } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  forumFindCommentsForAction,
  forumFindCommentsForActivity,
  forumFindCommentsForPost,
} from "@alliance/shared/client";
import { useCallback, useEffect, useRef, useState } from "react";

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

  const newestRequest = useRef(0);

  const target = `${type}:${objectId}`;
  // A caller can hand down a thread for another object without issuing a
  // request, so the number alone would leave the one in flight free to answer
  // under it.
  const shown = useRef(target);
  shown.current = target;

  const fetchComments = useCallback(async () => {
    const request = ++newestRequest.current;
    // The generated client leaves its fetch call unguarded, so a request that
    // never reaches the server rejects rather than answering with an error.
    const response = await R.fromPromise(
      THREAD_FETCHERS[type](objectId.toString()),
    );
    if (request !== newestRequest.current || target !== shown.current) return;
    if (!response.ok) {
      console.error("Failed to load comments:", response.error);
      return;
    }
    setThread(response.value.data ?? null);
  }, [objectId, type, target]);

  useEffect(() => {
    if (initialComments) {
      setThread(initialComments);
      return;
    }
    // Swapping the object drops the thread on screen rather than leaving it
    // under the new object's heading until the request lands.
    setThread(null);
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
