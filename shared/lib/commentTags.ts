import { CommentDto, PostTagDto } from "@alliance/shared/client";

export type TagFilter = number | null | undefined;

export function matchesTagFilter(
  comment: CommentDto,
  filter: TagFilter,
): boolean {
  return filter === undefined || comment.tagId === filter;
}

export type TagCounts = {
  all: number;
  untagged: number;
  byTagId: Record<number, number>;
};

export function countCommentsByTag(
  comments: CommentDto[],
  tags: readonly PostTagDto[],
): TagCounts {
  return {
    all: comments.length,
    untagged: comments.filter((comment) => comment.tagId === null).length,
    byTagId: Object.fromEntries(
      tags.map((tag) => [
        tag.id,
        comments.filter((comment) => comment.tagId === tag.id).length,
      ]),
    ),
  };
}

export type TagChip = { key: string; value: TagFilter; label: string };

export function buildTagChips(
  tags: readonly PostTagDto[],
  counts?: TagCounts,
): TagChip[] {
  return [
    ...(counts
      ? [{ key: "all", value: undefined, label: `All (${counts.all})` }]
      : []),
    ...tags.map((tag) => ({
      key: String(tag.id),
      value: tag.id,
      label: counts ? `${tag.name} (${counts.byTagId[tag.id] ?? 0})` : tag.name,
    })),
    ...(counts && counts.untagged > 0
      ? [
          {
            key: "untagged",
            value: null,
            label: `Untagged (${counts.untagged})`,
          },
        ]
      : []),
  ];
}
