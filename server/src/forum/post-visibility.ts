import { User } from "src/user/entities/user.entity";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { Post } from "./entities/post.entity";

/**
 * Keeps posts the viewer can open: not deleted, and either visible already or
 * scheduled but theirs to see early as an author, co-author, or admin.
 * `viewerIdSql` is a bound parameter or a column; without one, only visible
 * posts pass.
 */
export function filterVisiblePosts<T extends ObjectLiteral>(params: {
  qb: SelectQueryBuilder<T>;
  postAlias: string;
  viewerIdSql?: string;
  now?: Date;
}): SelectQueryBuilder<T> {
  const { qb, postAlias, viewerIdSql, now = new Date() } = params;
  qb.andWhere(`${postAlias}.deleted = false`);
  const clauses = [
    `${postAlias}.visibleAt IS NULL`,
    `${postAlias}.visibleAt < :postVisibility_now`,
  ];
  if (viewerIdSql !== undefined) {
    const coAuthorSubQuery = qb
      .subQuery()
      .select("1")
      .from(Post, "visPost")
      .innerJoin("visPost.authors", "visAuthor")
      .where(`visPost.id = ${postAlias}.id`)
      .andWhere(`visAuthor.id = ${viewerIdSql}`)
      .getQuery();
    const adminSubQuery = qb
      .subQuery()
      .select("1")
      .from(User, "visViewer")
      .where(`visViewer.id = ${viewerIdSql}`)
      .andWhere("visViewer.admin = true")
      .getQuery();
    clauses.push(`${postAlias}.authorId = ${viewerIdSql}`);
    clauses.push(`EXISTS ${coAuthorSubQuery}`);
    clauses.push(`EXISTS ${adminSubQuery}`);
  }
  return qb.andWhere(`(${clauses.join(" OR ")})`, {
    postVisibility_now: now,
  });
}
