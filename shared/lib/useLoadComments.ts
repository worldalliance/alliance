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
import { replaceEqualDeep } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { captureException } from "./analytics";
import { useHeldOn } from "./useHeldOn";

const MIN_SPIN_MS = 400;

const STATUS_LOADING = "Loading comments";
const STATUS_LOADED = "Comments loaded";
const STATUS_FAILED = "Loading comments failed";
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
  const [failure, setFailure] = useState<{
    message: string;
    canRetry: boolean;
  } | null>(null);
  // A thread loads on mount, and after a like, a reply, a delete, whether or
  // not anyone asked. Narrating those is noise, so only a press opens this.
  const [asked, setAsked] = useState<{ ended: string | null } | null>(null);

  const settle = useCallback(
    (ended: string) =>
      setAsked((prev) => (prev && !prev.ended ? { ended } : prev)),
    [],
  );

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
    const outcome = reportsFailure ? STATUS_FAILED : STATUS_LOADED;
    if (!sent.ok) {
      console.error("Failed to load comments:", sent.error);
      captureException(ExceptionEvent.LoadCommentsError, sent.error, {
        type,
        objectId,
      });
      if (reportsFailure) setFailure({ message: LOAD_FAILED, canRetry: true });
      settle(outcome);
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
        setFailure({
          message: refusalMessage({
            status: response.status,
            error,
            fallback: LOAD_FAILED,
            sessionExpired: SESSION_EXPIRED,
          }),
          // A refusal the reader has to act on, a sign-in or a route saying
          // no, answers a second request the same way.
          canRetry: response.status >= 500,
        });
      }
      settle(outcome);
      return;
    }
    // A comment the request left equal keeps its object, so the memos
    // downstream hit.
    setThread((prev) => replaceEqualDeep(prev, data));
    setFailure(null);
    settle(STATUS_LOADED);
  }, [objectId, type, target, settle]);

  // Kept per object. Matched against another object's array, an equal rebuild
  // would skip the write and leave that object's comments on screen.
  const handedDown = useRef<{ target: string; comments: CommentDto[] } | null>(
    null,
  );

  // A card follows the feed that seeded it. A re-render that rebuilt an equal
  // array is not news, and writing it back would undo a refetch the card had
  // already done. Only the write is skipped: an equal array still outruns a
  // request that is out, and clears the message a failed one left.
  useEffect(() => {
    if (!initialComments) return;
    const held = handedDown.current;
    const previous = held && held.target === target ? held.comments : null;
    handedDown.current = { target, comments: initialComments };
    outran.current = newestRequest.current;
    setFailure(null);
    if (previous && replaceEqualDeep(previous, initialComments) === previous) {
      return;
    }
    setThread((prev) => replaceEqualDeep(prev, initialComments));
  }, [initialComments, target]);

  // Swapping the object drops the thread on screen rather than leaving it
  // under the new object's heading until the request lands.
  useEffect(() => {
    if (initialComments) return;
    handedDown.current = null;
    setThread(null);
    setFailure(null);
    fetchComments();
  }, [initialComments, fetchComments]);

  // A thread swapped in under the reader answers no press of theirs.
  useEffect(() => setAsked(null), [target]);

  // A press is never turned away. The hook drops every answer but the newest
  // one's, and a request that hangs would leave this row's one control dead.
  const retry = useCallback(() => {
    setAsked({ ended: null });
    void fetchComments();
  }, [fetchComments]);

  const spinning = useHeldOn(asked?.ended === null, MIN_SPIN_MS);

  return {
    comments,
    setComments,
    error: failure?.message ?? null,
    canRetry: failure?.canRetry ?? false,
    spinning,
    // A second failure puts the same words in the error row, so its live region
    // announces nothing. This changes on every settle.
    status: !asked ? null : spinning ? STATUS_LOADING : asked.ended,
    fetchComments,
    retry,
  };
}
