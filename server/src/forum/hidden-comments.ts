import type { EntityManager } from "typeorm";

/**
 * The comments a thread leaves out: those a deleted account wrote and every
 * reply under them. Few accounts are deleted, so the set is small; walking it
 * a level at a time keeps each step an indexed lookup and keeps a recursive
 * estimate out of the readers' plans.
 */
export async function hiddenCommentIds(
  manager: EntityManager,
): Promise<number[]> {
  const ids = (rows: { id: number }[]) => rows.map((row) => row.id);
  const hidden: number[] = [];
  let level = ids(
    await manager.query(
      `SELECT c.id FROM comment c JOIN "user" u ON u.id = c."authorId" WHERE u."deletedAt" IS NOT NULL`,
    ),
  );
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
