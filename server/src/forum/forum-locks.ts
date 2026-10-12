import { NotFoundException } from "@nestjs/common";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { Action } from "src/actions/entities/action.entity";
import { assertLive, lockLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { EntityManager } from "typeorm";
import { Comment, CommentParentObject } from "./entities/comment.entity";
import { Post } from "./entities/post.entity";
import { isCommentHidden } from "./hidden-comments";

/** Taken first, the order an account deletion locks in, so a post or
 * comment cannot commit under an author deleted meanwhile. */
export async function lockLiveAuthor(
  manager: EntityManager,
  userId: number,
): Promise<void> {
  await assertLive(manager, {
    rows: [{ target: User, id: userId }],
    gone: () => new NotFoundException("User not found"),
  });
}

/** Locked so the action cannot be deleted before the post naming it commits. */
export async function lockLiveAction(
  manager: EntityManager,
  actionId: number,
): Promise<void> {
  await assertLive(manager, {
    rows: [{ target: Action, id: actionId }],
    gone: () => new NotFoundException(`Action with ID "${actionId}" not found`),
  });
}

/**
 * Holds the discussion a new comment joins, so a deletion committing
 * meanwhile either waits for the comment or makes this throw.
 */
export async function lockCommentDiscussion(params: {
  manager: EntityManager;
  parent: Pick<Comment, "parentObjectType" | "parentObjectId" | "parentId">;
}): Promise<void> {
  const { manager, parent } = params;
  const { parentObjectType, parentObjectId } = parent;
  const missing = () =>
    new NotFoundException("The reply you're answering is no longer here");
  const ancestors: Comment[] = [];
  let ancestorId = parent.parentId;
  while (ancestorId !== null) {
    const ancestor = await manager.findOne(Comment, {
      where: { id: ancestorId, parentObjectType, parentObjectId },
      withDeleted: true,
    });
    if (!ancestor) throw missing();
    ancestors.push(ancestor);
    ancestorId = ancestor.parentId;
  }
  // The accounts first, then the thread root first: the order an account
  // deletion's cascade locks them in.
  const post =
    parentObjectType === CommentParentObject.Post
      ? await manager.findOne(Post, {
          where: { id: parentObjectId },
          select: { id: true, authorId: true },
        })
      : null;
  for (const authorId of [
    ...(post ? [post.authorId] : []),
    ...ancestors.map((ancestor) => ancestor.authorId),
  ]) {
    await manager.exists(User, {
      where: { id: authorId },
      withDeleted: true,
      lock: { mode: "for_key_share" },
    });
  }

  let available: boolean;
  switch (parentObjectType) {
    case CommentParentObject.Post: {
      // Taken for no-key update: removing a post is a plain UPDATE of
      // deletedAt, which does not wait on a key-share lock.
      available = await manager.exists(Post, {
        where: { id: parentObjectId },
        lock: { mode: "for_no_key_update" },
      });
      break;
    }
    case CommentParentObject.Action:
      available = await lockLive(manager, [
        { target: Action, id: parentObjectId },
      ]);
      break;
    case CommentParentObject.Activity:
      available = await lockLive(manager, [
        { target: ActionActivity, id: parentObjectId },
      ]);
      break;
    default:
      throw new Error(
        `unknown comment parent: ${parentObjectType satisfies never}`,
      );
  }
  if (!available) {
    throw new NotFoundException("That discussion is no longer here");
  }

  for (const ancestor of ancestors.toReversed()) {
    if (
      !(await manager.exists(Comment, {
        where: { id: ancestor.id },
        // The parent itself must be live, and is taken for no-key update:
        // deleting a comment is a plain UPDATE of deletedAt, which does not
        // wait on a key-share lock.
        ...(ancestor.id === parent.parentId
          ? { lock: { mode: "for_no_key_update" } }
          : { withDeleted: true, lock: { mode: "for_key_share" } }),
      }))
    ) {
      throw missing();
    }
  }
  if (
    parent.parentId !== null &&
    (await isCommentHidden(manager, { id: parent.parentId, parentObjectId }))
  ) {
    throw missing();
  }
}
