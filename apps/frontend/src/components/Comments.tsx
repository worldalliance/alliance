import {
  CommentDto,
  CommentParentObject,
  PostTagDto,
} from "@alliance/shared/client";
import {
  CommentFilter,
  CommentSort,
  commentFilterLabels,
  getCommentFilterOptions,
  getSortOptions,
  matchesCommentFilter,
  sortComments,
  sortLabels,
  useCommentFilterData,
} from "@alliance/shared/lib/commentsFilter";
import {
  countCommentsByTag,
  matchesTagFilter,
} from "@alliance/shared/lib/commentTags";
import { commentThreadLanding } from "@alliance/shared/lib/copy";
import { useOptionalNotifications } from "@alliance/shared/lib/useNotifications";
import { useMarkUnreadContentRead } from "@alliance/shared/lib/useUnreadContentRead";
import { cn } from "@alliance/shared/styles/util";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import { Menu } from "@base-ui/react/menu";
import { ArrowUpDown, RefreshCw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import { Link, href } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { CommentsProvider, useCommentTree } from "./forum/CommentsContext";
import ReplyComponent from "./forum/ReplyComponent";
import TagChips from "./forum/TagChips";
import TopLevelComposer from "./forum/TopLevelComposer";

const NO_TAGS: readonly PostTagDto[] = [];
const NO_EXPERTS: number[] = [];

enum Landing {
  None = "none",
  Made = "made",
  Declined = "declined",
  Left = "left",
}

// The name has to be up before the move is made, so the state a settled load
// lands in carries it and a declined move takes it back down: a feed puts one
// of these under every card, and a named group on each is a stop no press
// opened. The landing is itself the answer, so the line stays quiet after it.
const LANDINGS: Record<Landing, { names: boolean; narrates: boolean }> = {
  [Landing.None]: { names: true, narrates: true },
  [Landing.Made]: { names: true, narrates: false },
  [Landing.Declined]: { names: false, narrates: true },
  [Landing.Left]: { names: false, narrates: false },
};

export interface CommentsProps {
  objectId: number;
  type: CommentParentObject;
  compact?: boolean;
  autofocus?: boolean;
  showForm?: boolean;
  initialComments?: CommentDto[];
  expertIds?: number[];
  expertLabel?: string;
  showClusterTags?: boolean;
  qaMode?: boolean;
  className?: string;
  showUserBadges?: boolean;
  tags?: readonly PostTagDto[];
}

const collectCommentIds = (comments: CommentDto[]): number[] => {
  const ids: number[] = [];
  for (const comment of comments) {
    ids.push(comment.id);
    if (comment.children?.length) {
      ids.push(...collectCommentIds(comment.children));
    }
  }
  return ids;
};

const SortDropdown = ({
  commentSort,
  sortOptions,
  onChange,
}: {
  commentSort: CommentSort;
  sortOptions: CommentSort[];
  onChange: (sort: CommentSort) => void;
}) => (
  <div className="ml-auto">
    <Menu.Root>
      <Menu.Trigger
        render={
          <BaseButton
            variant={BaseButtonVariant.TransparentMuted}
            iconRight={ArrowUpDown}
          />
        }
      >
        {sortLabels[commentSort]}
      </Menu.Trigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-[160px]">
        {sortOptions.map((sort) => (
          <DropdownMenuItem
            key={sort}
            onClick={() => onChange(sort)}
            className={cn(commentSort === sort && "font-medium text-black")}
          >
            {sortLabels[sort]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </Menu.Root>
  </div>
);

const Comments = ({
  objectId,
  type,
  compact,
  autofocus,
  showForm = true,
  initialComments,
  expertIds = NO_EXPERTS,
  expertLabel,
  showClusterTags = false,
  qaMode = false,
  className,
  showUserBadges = true,
  tags = NO_TAGS,
}: CommentsProps) => {
  const { user } = useAuth();
  // useAuth() is hydrated before this mounts in the common case, so the initializer
  // picks the right default without needing an effect to react to late-arriving user data.
  const [commentFilter, setCommentFilter] = useState<CommentFilter>(
    CommentFilter.All,
  );
  const [commentSort, setCommentSort] = useState<CommentSort>(
    showClusterTags && user?.clusterId != null
      ? CommentSort.SameCluster
      : CommentSort.Newest,
  );
  const [randomSeed, setRandomSeed] = useState(() => String(Math.random()));

  const tree = useCommentTree(objectId, type, initialComments);
  const notifications = useOptionalNotifications();
  const isPostComments = type === "post";
  const activeQaMode = isPostComments && qaMode;

  const commentIds = useMemo(
    () => collectCommentIds(tree.comments ?? []),
    [tree.comments],
  );

  useMarkUnreadContentRead({
    contentType: "forum_reply",
    contentIds: commentIds,
    enabled: !!user && !!notifications && commentIds.length > 0,
    onMarked: (contentType, contentIds) => {
      notifications?.applyNotificationsReadByContent(contentType, contentIds);
    },
  });

  const { friendIdSet, groupMemberIdSet } = useCommentFilterData({
    enabled: !!user && isPostComments,
    userId: user?.id,
  });

  const topLevelComments = useMemo(
    () =>
      (tree.comments ?? []).filter(
        (comment) => !comment.deleted || comment.children?.length,
      ),
    [tree.comments],
  );

  const hasMineComments = useMemo(
    () =>
      !!user &&
      topLevelComments.some((comment) => comment.author.id === user.id),
    [topLevelComments, user],
  );

  const hasSameGroup = showClusterTags && user?.clusterId != null;

  const filterOptions = useMemo(
    () =>
      getCommentFilterOptions({
        activeQaMode,
        hasMineComments,
        hasSameGroup,
      }),
    [activeQaMode, hasMineComments, hasSameGroup],
  );

  const sortOptions = useMemo(
    () => getSortOptions({ hasSameGroup }),
    [hasSameGroup],
  );

  useEffect(() => {
    if (!filterOptions.includes(commentFilter)) {
      setCommentFilter(CommentFilter.All);
    }
  }, [filterOptions, commentFilter]);

  useEffect(() => {
    if (!sortOptions.includes(commentSort)) {
      setCommentSort(CommentSort.Newest);
    }
  }, [sortOptions, commentSort]);

  const filterContext = useMemo(
    () => ({
      userId: user?.id,
      userClusterId: user?.clusterId,
      expertIds,
      friendIdSet,
      groupMemberIdSet,
    }),
    [user?.id, user?.clusterId, expertIds, friendIdSet, groupMemberIdSet],
  );

  const commentCounts = useMemo(() => {
    const counts = {} as Record<CommentFilter, number>;
    for (const filter of filterOptions) {
      counts[filter] = topLevelComments.filter((comment) =>
        matchesCommentFilter(comment, filter, filterContext),
      ).length;
    }
    return counts;
  }, [filterOptions, topLevelComments, filterContext]);

  const filterMatchedComments = useMemo(
    () =>
      topLevelComments.filter((comment) =>
        matchesCommentFilter(comment, commentFilter, filterContext),
      ),
    [topLevelComments, commentFilter, filterContext],
  );

  const tagCounts = useMemo(
    () => countCommentsByTag(filterMatchedComments, tags),
    [filterMatchedComments, tags],
  );

  const filteredComments = useMemo(
    () =>
      sortComments(
        filterMatchedComments.filter((comment) =>
          matchesTagFilter(comment, tree.tagFilter),
        ),
        commentSort,
        { randomSeed, userClusterId: user?.clusterId },
      ),
    [
      filterMatchedComments,
      commentSort,
      randomSeed,
      tree.tagFilter,
      user?.clusterId,
    ],
  );

  const thread = useRef<HTMLDivElement>(null);
  // Focus falls to the body when the control comes out from under the reader,
  // and a click on plain page text leaves it there too. What separates them is
  // whether the control still held it when it went, which React answers by
  // detaching this ref before the node leaves the document.
  const controlHeldFocus = useRef(false);
  const holdControl = useCallback(
    (node: HTMLButtonElement) => () => {
      controlHeldFocus.current = document.activeElement === node;
    },
    [],
  );
  const [landing, setLanding] = useState(Landing.None);

  // The retry control unmounts with the row that carries the message, so a
  // press that works drops the reader on the body. Only then do they land on
  // the thread they asked for, and only if nothing has taken focus since.
  useEffect(() => {
    if (!tree.movesReader) {
      setLanding(Landing.None);
      return;
    }
    // A reader still at the row can see the thread already, and one who
    // scrolled off during the load keeps their place, so nothing scrolls.
    const lands =
      controlHeldFocus.current && document.activeElement === document.body;
    controlHeldFocus.current = false;
    if (!lands) {
      setLanding(Landing.Declined);
      return;
    }
    thread.current?.focus({ preventScroll: true });
    setLanding(
      document.activeElement === thread.current
        ? Landing.Made
        : Landing.Declined,
    );
  }, [tree.movesReader]);

  // A reader nobody moved is still owed the line, and Left is silent, so only a
  // landing that was made demotes to it.
  const leaveThread = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setLanding((prev) => (prev === Landing.Made ? Landing.Left : prev));
  }, []);

  // The spin holds the words back long enough for the move above to answer
  // first, and a reader it left where they were still gets the line.
  const named = tree.movesReader && LANDINGS[landing].names;
  const narrated = LANDINGS[landing].narrates ? tree.status : null;

  const ctxValue = useMemo(
    () => ({
      user,
      replyingTo: tree.replyingTo,
      setReplyingTo: tree.setReplyingTo,
      handleSubmitReply: tree.handleSubmitReply,
      handleDeleteReply: tree.handleDeleteReply,
      onUpdateReply: tree.handleUpdateReply,
      submitErrorFor: tree.submitErrorFor,
      clearSubmitError: tree.clearSubmitError,
      deleteErrorFor: tree.deleteErrorFor,
      clearDeleteError: tree.clearDeleteError,
      onLikeReply: tree.handleLikeReply,
      onPinReply: tree.handlePinReply,
      newlyAddedReplies: tree.newlyAddedReplies,
      highlightedReplyId: tree.highlightedReplyId,
      expertIds,
      expertLabel,
      showClusterTags,
      compact,
      showUserBadges,
      tags,
    }),
    [
      user,
      tree.replyingTo,
      tree.setReplyingTo,
      tree.handleSubmitReply,
      tree.handleDeleteReply,
      tree.handleUpdateReply,
      tree.submitErrorFor,
      tree.clearSubmitError,
      tree.deleteErrorFor,
      tree.clearDeleteError,
      tree.handleLikeReply,
      tree.handlePinReply,
      tree.newlyAddedReplies,
      tree.highlightedReplyId,
      expertIds,
      expertLabel,
      showClusterTags,
      compact,
      showUserBadges,
      tags,
    ],
  );

  return (
    <CommentsProvider value={ctxValue}>
      <div className={className}>
        {user && showForm ? (
          <TopLevelComposer
            replyingTo={tree.replyingTo}
            onSubmit={tree.handleSubmitReply}
            setReplyingTo={tree.setReplyingTo}
            focusOnMount={!!autofocus && tree.focusComposer}
            compact={compact}
            startExpanded={autofocus}
            error={tree.submitErrorFor(null)}
            onDismissError={tree.clearSubmitError}
            tags={isPostComments ? tags : NO_TAGS}
            selectedTagId={tree.selectedTagId}
            setSelectedTagId={tree.setSelectedTagId}
          />
        ) : !user && !compact ? (
          <div className="text-center py-6 bg-zinc-50 rounded border border-zinc-200">
            <p className="text-zinc-600">
              Please{" "}
              <Link to={href("/login")} className="text-green hover:underline">
                log in
              </Link>{" "}
              to post a reply.
            </p>
          </div>
        ) : null}
        {isPostComments && topLevelComments.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-3">
            <div className="flex items-center gap-2">
              <span>{activeQaMode ? "Q&A mode" : "Filter:"}</span>
              <div className="flex gap-1 rounded text-[14px]">
                {filterOptions.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setCommentFilter(filter)}
                    className={cn(
                      "px-3 py-2 rounded",
                      commentFilter === filter
                        ? "bg-zinc-200/70 text-black font-medium"
                        : "text-zinc-600",
                    )}
                  >
                    {commentFilterLabels[filter]} ({commentCounts[filter] ?? 0})
                  </button>
                ))}
              </div>
            </div>
            <SortDropdown
              commentSort={commentSort}
              sortOptions={sortOptions}
              onChange={(sort) => {
                setCommentSort(sort);
                if (sort === CommentSort.Random) {
                  setRandomSeed(String(Math.random()));
                }
              }}
            />
          </div>
        )}
        {isPostComments && tags.length > 0 && topLevelComments.length > 0 && (
          <TagChips
            className="my-3"
            tags={tags}
            selected={tree.tagFilter}
            onSelect={tree.setTagFilter}
            counts={tagCounts}
          />
        )}
        <InlineError message={tree.error}>
          {tree.canRetry && (
            <button
              type="button"
              ref={holdControl}
              onClick={tree.retry}
              aria-busy={tree.spinning}
              aria-label="Try loading the comments again"
              title="Try loading the comments again"
              className="p-1 hover:text-red-700"
            >
              <RefreshCw
                className={cn("w-4 h-4", tree.spinning && "animate-spin")}
              />
            </button>
          )}
        </InlineError>
        <span role="status" className="sr-only">
          {narrated ?? ""}
        </span>
        <div
          ref={thread}
          tabIndex={-1}
          onBlur={leaveThread}
          // A screen reader reads a focused container with no name of its own
          // out in full, so the landing names the thread instead of reciting
          // it.
          role={named ? "group" : undefined}
          aria-label={
            named
              ? commentThreadLanding({
                  shown: filteredComments.length,
                  total: topLevelComments.length,
                })
              : undefined
          }
          className={cn(
            "focus:outline-none",
            topLevelComments.length > 0 && "mt-3",
          )}
        >
          {filteredComments.map((reply) => (
            <ReplyComponent key={reply.id} reply={reply} />
          ))}
        </div>
      </div>
    </CommentsProvider>
  );
};

export default Comments;
