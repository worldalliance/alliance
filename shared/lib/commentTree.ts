import { CommentDto } from "@alliance/shared/client";

/**
 * Replaces one comment in the tree, returning the array it was handed wherever
 * nothing under it changed.
 */
export function updateCommentInTree({
  comments,
  id,
  update,
}: {
  comments: CommentDto[];
  id: number;
  update: (comment: CommentDto) => CommentDto;
}): CommentDto[] {
  let changed = false;
  const next = comments.map((comment) => {
    if (comment.id === id) {
      changed = true;
      return update(comment);
    }
    if (comment.children?.length) {
      const children = updateCommentInTree({
        comments: comment.children,
        id,
        update,
      });
      if (children !== comment.children) {
        changed = true;
        return { ...comment, children };
      }
    }
    return comment;
  });
  return changed ? next : comments;
}
