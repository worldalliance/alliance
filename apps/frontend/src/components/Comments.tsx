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
import { Menu } from "@base-ui/react/menu";
import { ArrowUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, href } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { CommentsProvider, useCommentTree } from "./forum/CommentsContext";
import ReplyComponent from "./forum/ReplyComponent";
import ReplyForm from "./forum/ReplyForm";
import TagChips from "./forum/TagChips";

const NO_TAGS: readonly PostTagDto[] = [];

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
  expertIds = [],
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
        {user && !tree.replyingTo && showForm ? (
          <ReplyForm
            parentId={null}
            editableContent={tree.editableContent}
            setEditableContent={tree.setEditableContent}
            onSubmit={tree.handleSubmitReply}
            setReplyingTo={tree.setReplyingTo}
            compact={compact}
            startExpanded={autofocus}
            error={tree.submitErrorFor(null)}
            onDismissError={tree.clearSubmitError}
            tags={isPostComments ? tags : []}
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
        {tree.error && <div className="text-red-500">{tree.error}</div>}
        {topLevelComments.length > 0 ? (
          <div className="mt-3">
            {filteredComments.map((reply) => (
              <ReplyComponent key={reply.id} reply={reply} />
            ))}
          </div>
        ) : null}
      </div>
    </CommentsProvider>
  );
};

export default Comments;
