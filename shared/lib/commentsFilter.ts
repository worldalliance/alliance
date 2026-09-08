import { CommentDto, userListFriends } from "@alliance/shared/client";
import { hashStringToSeed } from "@alliance/shared/forms/randomutils";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export enum CommentFilter {
  All = "all",
  SameCluster = "sameGroup",
  Mine = "mine",
  Answered = "answered",
  Unanswered = "unanswered",
  Friends = "friends",
  GroupMembers = "groupMembers",
}

export const commentFilterLabels: Record<CommentFilter, string> = {
  [CommentFilter.All]: "All",
  [CommentFilter.SameCluster]: "Introduction group",
  [CommentFilter.Mine]: "Mine",
  [CommentFilter.Answered]: "Answered",
  [CommentFilter.Unanswered]: "Unanswered",
  [CommentFilter.Friends]: "Friends",
  [CommentFilter.GroupMembers]: "Group",
};

export enum CommentSort {
  Newest = "newest",
  SameCluster = "sameGroup",
  Discussion = "discussion",
  Random = "random",
}

export const sortLabels: Record<CommentSort, string> = {
  [CommentSort.Newest]: "Newest",
  [CommentSort.SameCluster]: "Introduction group",
  [CommentSort.Discussion]: "Most discussion",
  [CommentSort.Random]: "Random",
};

export function getSortOptions({
  hasSameGroup,
}: {
  hasSameGroup: boolean;
}): CommentSort[] {
  const options: CommentSort[] = [CommentSort.Newest];
  if (hasSameGroup) options.push(CommentSort.SameCluster);
  options.push(CommentSort.Discussion, CommentSort.Random);
  return options;
}

export function countAllReplies(replies: CommentDto[]): number {
  let count = 0;
  for (const reply of replies) {
    count += 1;
    if (reply.children && reply.children.length > 0) {
      count += countAllReplies(reply.children);
    }
  }
  return count;
}

export function latestActivityAt(comment: CommentDto): number {
  return (comment.children ?? []).reduce(
    (latest, child) => Math.max(latest, latestActivityAt(child)),
    new Date(comment.createdAt).getTime(),
  );
}

export function hasExpertReply(
  comment: CommentDto,
  expertIds: number[],
): boolean {
  if (expertIds.includes(comment.author.id)) return true;
  if (comment.children) {
    return comment.children.some((child) => hasExpertReply(child, expertIds));
  }
  return false;
}

export function hasExpertChildReply(
  comment: CommentDto,
  expertIds: number[],
): boolean {
  if (!comment.children) return false;
  return comment.children.some((child) => hasExpertReply(child, expertIds));
}

export function getCommentFilterOptions({
  activeQaMode,
  hasMineComments,
  hasSameGroup,
}: {
  activeQaMode: boolean;
  hasMineComments: boolean;
  hasSameGroup: boolean;
}): CommentFilter[] {
  const base: CommentFilter[] = activeQaMode
    ? [CommentFilter.All, CommentFilter.Answered, CommentFilter.Unanswered]
    : [CommentFilter.All, CommentFilter.Friends, CommentFilter.GroupMembers];
  if (hasMineComments) {
    base.splice(1, 0, CommentFilter.Mine);
  }
  if (hasSameGroup) {
    base.splice(1, 0, CommentFilter.SameCluster);
  }
  return base;
}

export interface CommentFilterContext {
  userId: number | undefined;
  userClusterId: number | null | undefined;
  expertIds: number[];
  friendIdSet: Set<number>;
  groupMemberIdSet: Set<number>;
}

export function matchesCommentFilter(
  comment: CommentDto,
  filter: CommentFilter,
  ctx: CommentFilterContext,
): boolean {
  const { userId, userClusterId, expertIds, friendIdSet, groupMemberIdSet } =
    ctx;
  switch (filter) {
    case CommentFilter.All:
      return true;
    case CommentFilter.Mine:
      return userId != null && comment.author.id === userId;
    case CommentFilter.SameCluster:
      if (userId == null || userClusterId == null) return false;
      return comment.author.cluster?.id === userClusterId;
    case CommentFilter.Answered:
      return hasExpertChildReply(comment, expertIds);
    case CommentFilter.Unanswered: {
      // exclude expert-authored comments with no expert replies
      const isExpert = expertIds.includes(comment.author.id);
      const hasExpertChild = hasExpertChildReply(comment, expertIds);
      return !isExpert && !hasExpertChild;
    }
    case CommentFilter.Friends:
      if (userId == null) return false;
      if (comment.author.id === userId) return true;
      return friendIdSet.has(comment.author.id);
    case CommentFilter.GroupMembers:
      if (userId == null) return false;
      if (comment.author.id === userId) return true;
      return groupMemberIdSet.has(comment.author.id);
    default:
      throw new Error(`unknown filter: ${filter satisfies never}`);
  }
}

export function sortComments(
  comments: CommentDto[],
  sort: CommentSort,
  options?: { randomSeed?: string; userClusterId?: number | null },
): CommentDto[] {
  switch (sort) {
    case CommentSort.Random: {
      const seed = options?.randomSeed ?? String(Math.random());
      const pinned: CommentDto[] = [];
      const rest: { comment: CommentDto; score: number }[] = [];
      for (const c of comments) {
        if (c.pinned) {
          pinned.push(c);
        } else {
          rest.push({ comment: c, score: hashStringToSeed(`${seed}:${c.id}`) });
        }
      }
      rest.sort((a, b) => a.score - b.score);
      return [...pinned, ...rest.map((r) => r.comment)];
    }
    case CommentSort.Newest:
      return [...comments].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.pinned) return latestActivityAt(b) - latestActivityAt(a);
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    case CommentSort.SameCluster: {
      const userClusterId = options?.userClusterId;
      return [...comments].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (userClusterId != null) {
          const aSame = a.author.cluster?.id === userClusterId;
          const bSame = b.author.cluster?.id === userClusterId;
          if (aSame !== bSame) return aSame ? -1 : 1;
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }
    case CommentSort.Discussion:
      return [...comments].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (
          countAllReplies(b.children ?? []) - countAllReplies(a.children ?? [])
        );
      });
    default:
      throw new Error(`unknown sort: ${sort satisfies never}`);
  }
}

export function useCommentFilterData({
  enabled,
  userId,
}: {
  enabled: boolean;
  userId: number | undefined;
}) {
  const { data: friendIds = [] } = useQuery({
    queryKey: ["userListFriends", userId],
    queryFn: () =>
      userListFriends({ path: { id: userId! } }).then((res) =>
        (res.data ?? []).map((friend) => friend.id),
      ),
    enabled: enabled && userId != null,
  });

  const { communities } = useMyCommunities({
    enabled: enabled && userId != null,
  });

  const friendIdSet = useMemo(() => new Set(friendIds), [friendIds]);
  const groupMemberIdSet = useMemo(() => {
    const ids = new Set<number>();
    for (const community of communities) {
      for (const member of community.users ?? []) {
        ids.add(member.id);
      }
    }
    return ids;
  }, [communities]);

  return { friendIdSet, groupMemberIdSet };
}
