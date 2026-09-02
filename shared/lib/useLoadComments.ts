import { ExceptionEvent } from "@alliance/common/analytics";
import { refusalMessage } from "@alliance/common/errorMessage";
import { R } from "@alliance/common/result";
import {
  CommentDto,
  CommentParentObject,
  forumFindCommentsForAction,
  forumFindCommentsForActivity,
  forumFindCommentsForPost,
} from "@alliance/shared/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { captureException } from "./analytics";

const LOAD_FAILED = "Failed to load comments";
const SESSION_EXPIRED =
  "Your session has expired. Sign in again to load the replies.";

type ThreadFetcher = (
  id: string,
) => Promise<{ data?: CommentDto[]; error?: unknown; response: Response }>;

// Mobile configures the client to throw on a refusal, which loses the response
// the status below is read off.
const THREAD_FETCHERS: Record<CommentParentObject, ThreadFetcher> = {
  post: (id) => forumFindCommentsForPost({ path: { id }, throwOnError: false }),
  activity: (id) =>
    forumFindCommentsForActivity({ path: { id }, throwOnError: false }),
  action: (id) =>
    forumFindCommentsForAction({ path: { id }, throwOnError: false }),
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
  // The newest request the caller has handed a thread down over.
  const outran = useRef(0);

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
    const sent = await R.fromPromise(
      THREAD_FETCHERS[type](objectId.toString()),
    );
    if (request !== newestRequest.current || target !== shown.current) return;
    // A thread the caller handed down while this was out is at least as new as
    // the one it asked for, so its failure has nothing left to say about what
    // is on screen. Its comments still do, since they come from a later read.
    const reportsFailure = request > outran.current;
    if (!sent.ok) {
      console.error("Failed to load comments:", sent.error);
      captureException(ExceptionEvent.LoadCommentsError, sent.error, {
        type,
        objectId,
      });
      if (reportsFailure) setError(LOAD_FAILED);
      return;
    }
    const { data, error, response } = sent.value;
    if (!data) {
      console.error("The server refused the comment load:", error);
      captureException(ExceptionEvent.LoadCommentsError, error, {
        type,
        objectId,
        status: response.status,
      });
      if (reportsFailure) {
        setError(
          refusalMessage({
            status: response.status,
            error,
            fallback: LOAD_FAILED,
            sessionExpired: SESSION_EXPIRED,
          }),
        );
      }
      return;
    }
    setThread(data);
    setError(null);
  }, [objectId, type, target]);

  useEffect(() => {
    if (initialComments) {
      outran.current = newestRequest.current;
      setThread(initialComments);
      setError(null);
      return;
    }
    // Swapping the object drops the thread on screen rather than leaving it
    // under the new object's heading until the request lands.
    setThread(null);
    setError(null);
    fetchComments();
  }, [initialComments, fetchComments]);

  return {
    comments,
    setComments,
    error,
    fetchComments,
  };
}
