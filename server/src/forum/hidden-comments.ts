import type { EntityManager, ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { CommentParentObject, type Comment } from "./entities/comment.entity";

/**
 * The comments a thread leaves out: those a deleted account wrote and every
 * reply under them. A reply shares its parent's `parentObjectId`, so
 * `parentObjectIds` limits the walk to comments under those parent ids, of any
 * parent type.
 */
export async function hiddenCommentIds(
  manager: EntityManager,
  parentObjectIds: number[],
): Promise<number[]> {
  const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
  const hidden: number[] = [];
  let level = ids(
    await manager.query(
      `SELECT c.id FROM comment c JOIN "user" u ON u.id = c."authorId" WHERE u."deletedAt" IS NOT NULL AND c."parentObjectId" = ANY($1)`,
      [parentObjectIds],
    ),
  );
  // Few accounts are deleted, so the set is small; walking it a level at a
  // time keeps each step an indexed lookup and keeps a recursive estimate out
  // of the readers' plans.
  while (level.length) {
    hidden.push(...level);
    level = ids(
      await manager.query(`SELECT id FROM comment WHERE "parentId" = ANY($1)`, [
        level,
      ]),
    );
  }
  return hidden;
}

/** `comments` without the hidden ones, looked up in their own threads only. */
export async function withoutHiddenComments<
  C extends Pick<Comment, "id" | "parentObjectId">,
>(manager: EntityManager, comments: C[]): Promise<C[]> {
  if (!comments.length) return comments;
  const hidden = new Set(
    await hiddenCommentIds(manager, [
      ...new Set(comments.map((comment) => comment.parentObjectId)),
    ]),
  );
  return comments.filter((comment) => !hidden.has(comment.id));
}

/**
 * Per post, how many of the comments its thread shows are not deleted. A
 * deleted comment's replies still count; a comment by a deleted account and
 * every reply under it do not.
 */
export async function countThreadComments(
  manager: EntityManager,
  params: { postIds: number[]; hiddenIds: number[] },
): Promise<Map<number, number>> {
  const rows: { postId: number; count: string }[] = await manager.query(
    `SELECT c."parentObjectId" AS "postId", COUNT(*) AS count
     FROM comment c
     WHERE c."parentObjectType" = $1
       AND c."parentObjectId" = ANY($2)
       AND NOT c.deleted
       AND NOT (c.id = ANY($3))
     GROUP BY c."parentObjectId"`,
    [CommentParentObject.Post, params.postIds, params.hiddenIds],
  );
  return new Map(rows.map((row) => [row.postId, Number(row.count)]));
}

/**
 * Leaves out comments a deleted account wrote or that sit under one, checking
 * each row's ancestors, for readers spanning every thread, where the hidden
 * set grows with each deleted account.
 */
export function excludeCommentsUnderDeletedAuthors<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
): SelectQueryBuilder<T> {
  return qb.andWhere(
    `NOT EXISTS (
      WITH RECURSIVE ancestry AS (
        SELECT c.id, c."parentId", c."authorId" FROM comment c WHERE c.id = ${qb.alias}.id
        UNION ALL
        SELECT p.id, p."parentId", p."authorId" FROM comment p JOIN ancestry a ON p.id = a."parentId"
      )
      SELECT 1 FROM ancestry a JOIN "user" u ON u.id = a."authorId" WHERE u."deletedAt" IS NOT NULL
    )`,
  );
}

/** Whether a deleted account wrote the comment or any comment above it. */
export async function isCommentHidden(
  manager: EntityManager,
  comment: Pick<Comment, "id" | "parentObjectId">,
): Promise<boolean> {
  return (await hiddenCommentIds(manager, [comment.parentObjectId])).includes(
    comment.id,
  );
}
