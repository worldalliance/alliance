import { Action } from "src/actions/entities/action.entity";
import { assertNotInStaffPreview } from "src/actions/staff-preview";
import type { EntityManager } from "typeorm";
import { CommentParentObject, type Comment } from "./entities/comment.entity";

export async function assertCommentParentNotInStaffPreview(
  manager: EntityManager,
  parent: Pick<Comment, "parentObjectType" | "parentObjectId">,
): Promise<void> {
  let action: Action | null;
  switch (parent.parentObjectType) {
    case CommentParentObject.Post:
      return;
    case CommentParentObject.Action:
      action = await manager.findOne(Action, {
        where: { id: parent.parentObjectId },
        relations: { events: true },
      });
      break;
    case CommentParentObject.Activity:
      action = await manager.findOne(Action, {
        where: { activities: { id: parent.parentObjectId } },
        relations: { events: true },
      });
      break;
    default:
      throw new Error(
        `unknown comment parent: ${parent.parentObjectType satisfies never}`,
      );
  }
  if (action) {
    assertNotInStaffPreview(action);
  }
}
