type CommentParentType = "post" | "action" | "activity";

/** Requires `actionId` for an activity comment. */
export function commentPath(
  comment: {
    parentObjectType: CommentParentType;
    parentObjectId: number;
    id: number;
  },
  actionId?: number,
): string {
  const query = `?replyId=${comment.id}`;
  switch (comment.parentObjectType) {
    case "post":
      return `/forum/post/${comment.parentObjectId}${query}`;
    case "action":
      return `/actions/${comment.parentObjectId}${query}`;
    case "activity":
      if (actionId === undefined) {
        throw new Error(`activity comment ${comment.id} has no action id`);
      }
      return `/actions/${actionId}/activity/${comment.parentObjectId}${query}`;
    default:
      throw new Error(
        `unknown comment parent: ${comment.parentObjectType satisfies never}`,
      );
  }
}
