import { R, type Result } from "@alliance/common/result";
import type { PostDto, UpdatePostSettingsDto } from "@alliance/shared/client";
import { href } from "react-router";

export const postHref = (postId?: number) =>
  href("/content/posts/:postId?", {
    postId: postId === undefined ? undefined : String(postId),
  });

/** A path id that can't be a post's, such as "abc", is `null`. */
export const parsePostId = (raw: string | undefined) =>
  raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;

export const matchesSearch = (post: PostDto, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    post.title.toLowerCase().includes(needle) ||
    post.author.displayName.toLowerCase().includes(needle)
  );
};

export type TagDraft = { id?: number; name: string };

export type PostSettings = {
  authorIds: number[];
  qaMode: boolean;
  expertLabel: string;
  expertIds: number[];
  notifyForReplies: boolean;
  showClusterTags: boolean;
  tags: TagDraft[];
};

const savedTags = (post: PostDto): TagDraft[] =>
  (post.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name }));

export const settingsOf = (post: PostDto): PostSettings => ({
  authorIds: post.authorIds,
  qaMode: post.qaMode,
  expertLabel: post.expertLabel ?? "",
  expertIds: post.expertIds,
  notifyForReplies: post.notifyForReplies,
  showClusterTags: post.showClusterTags,
  tags: savedTags(post),
});

export const DUPLICATE_TAG_ERROR = "Give each tag a different name";

export type PostSave = {
  body: UpdatePostSettingsDto;
  /** Saved tags the save deletes, which staff confirm first. */
  deletedTags: TagDraft[];
};

/**
 * What a save sends: tag names trimmed and blanks dropped, and the tags only
 * when they changed, with the ids the server checks no one else changed.
 */
export function postSaveOf(
  post: PostDto,
  settings: PostSettings,
): Result<PostSave, string> {
  const tags = settings.tags
    .map((tag) => ({ ...tag, name: tag.name.trim() }))
    .filter((tag) => tag.name.length > 0);
  if (new Set(tags.map((tag) => tag.name)).size !== tags.length) {
    return R.failure(DUPLICATE_TAG_ERROR);
  }
  const saved = savedTags(post);
  const tagsChanged =
    tags.length !== saved.length ||
    tags.some((tag, i) => tag.id !== saved[i].id || tag.name !== saved[i].name);
  return R.success({
    deletedTags: saved.filter((old) => !tags.some((tag) => tag.id === old.id)),
    body: {
      authorIds: settings.authorIds,
      expertIds: settings.expertIds,
      qaMode: settings.qaMode,
      expertLabel: settings.expertLabel || null,
      notifyForReplies: settings.notifyForReplies,
      showClusterTags: settings.showClusterTags,
      tags: tagsChanged
        ? { tags, knownTagIds: saved.flatMap((tag) => tag.id ?? []) }
        : undefined,
    },
  });
}

export const deleteTagsQuestion = (deleted: TagDraft[]) => ({
  title:
    deleted.length === 1
      ? `Delete the tag “${deleted[0].name}”?`
      : `Delete the tags ${deleted.map((tag) => `“${tag.name}”`).join(", ")}?`,
  message: `Comments filed under ${
    deleted.length === 1 ? "that tag" : "those tags"
  } lose their label. This can't be undone.`,
  confirmLabel: deleted.length === 1 ? "Delete tag" : "Delete tags",
  destructive: true,
});
