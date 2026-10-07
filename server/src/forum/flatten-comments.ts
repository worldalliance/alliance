import type { Comment } from "./entities/comment.entity";

export function flattenComments(comments: Comment[]): Comment[] {
  return comments.flatMap((comment) => [
    comment,
    ...flattenComments(comment.children ?? []),
  ]);
}
