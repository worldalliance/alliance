import { MigrationInterface, QueryRunner } from 'typeorm';

function liveCommentParent(commentAlias: string): string {
  return `(
    (${commentAlias}."parentObjectType" = 'post' AND EXISTS (
      SELECT 1 FROM "post" p
      WHERE p."id" = ${commentAlias}."parentObjectId" AND p."deleted" = false
    ))
    OR (${commentAlias}."parentObjectType" = 'action' AND EXISTS (
      SELECT 1 FROM "action" a
      WHERE a."id" = ${commentAlias}."parentObjectId"
    ))
    OR (${commentAlias}."parentObjectType" = 'activity' AND EXISTS (
      SELECT 1 FROM "action_activity" aa
      WHERE aa."id" = ${commentAlias}."parentObjectId"
    ))
  )`;
}

function liveComment(idExpression: string): string {
  return `EXISTS (
    SELECT 1 FROM "comment" c
    WHERE c."id" = ${idExpression}
      AND c."deleted" = false
      AND ${liveCommentParent('c')}
  )`;
}

export class CleanupOrphanedNotifications1785524344700 implements MigrationInterface {
  name = 'CleanupOrphanedNotifications1785524344700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Structured results: a bare query() hands back the driver's raw
    // [rows, rowCount] pair, which would make every count below read as 2.
    const affectedRows = async (sql: string): Promise<number> => {
      const result = (await queryRunner.query(sql, undefined, true)) as {
        affected?: number | null;
      };
      return result.affected ?? 0;
    };

    const orphanedComments = await affectedRows(
      `UPDATE "comment" c SET "deleted" = true
       WHERE c."deleted" = false
         AND NOT ${liveCommentParent('c')}`,
    );

    const retiredUnread = await affectedRows(
      `UPDATE "unread_content" uc
       SET "shouldPush" = false, "readAt" = COALESCE(uc."readAt", NOW())
       WHERE uc."contentType" = 'forum_reply'
         AND (uc."shouldPush" = true OR uc."readAt" IS NULL)
         AND NOT ${liveComment('uc."contentId"')}`,
    );

    const retiredActionUpdateUnread = await affectedRows(
      `UPDATE "unread_content" uc
       SET "shouldPush" = false, "readAt" = COALESCE(uc."readAt", NOW())
       WHERE uc."contentType" = 'action_update'
         AND (uc."shouldPush" = true OR uc."readAt" IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM "action_update" au WHERE au."id" = uc."contentId"
         )`,
    );

    const commentLinked = await affectedRows(
      `DELETE FROM "notification" n
       WHERE n."commentId" IS NOT NULL AND NOT ${liveComment('n."commentId"')}`,
    );

    // Like notifications carry no foreign key — only a grouping key naming
    // their target. MATERIALIZED keeps the cast from being pushed onto rows
    // the pattern rejects. bigint because an int4 overflow would abort the
    // whole migration; every real id fits.
    const commentLikes = await affectedRows(
      `WITH dead AS MATERIALIZED (
         SELECT "id", split_part("groupingKey", ':', 3)::bigint AS "commentId"
         FROM "notification"
         WHERE "category" = 'likes'
           AND "groupingKey" ~ '^forum_like:comment:[0-9]+$'
       )
       DELETE FROM "notification" n USING dead
       WHERE n."id" = dead."id" AND NOT ${liveComment('dead."commentId"')}`,
    );

    const postLikes = await affectedRows(
      `WITH dead AS MATERIALIZED (
         SELECT "id", split_part("groupingKey", ':', 3)::bigint AS "postId"
         FROM "notification"
         WHERE "category" = 'likes'
           AND "groupingKey" ~ '^forum_like:post:[0-9]+:user:[0-9]+$'
       )
       DELETE FROM "notification" n USING dead
       WHERE n."id" = dead."id"
         AND NOT EXISTS (
           SELECT 1 FROM "post" p
           WHERE p."id" = dead."postId" AND p."deleted" = false
         )`,
    );

    const activityLikes = await affectedRows(
      `WITH dead AS MATERIALIZED (
         SELECT "id", split_part("groupingKey", ':', 2)::bigint AS "activityId"
         FROM "notification"
         WHERE "category" = 'likes'
           AND "groupingKey" ~ '^activity_like:[0-9]+$'
       )
       DELETE FROM "notification" n USING dead
       WHERE n."id" = dead."id"
         AND NOT EXISTS (
           SELECT 1 FROM "action_activity" a WHERE a."id" = dead."activityId"
         )`,
    );

    console.log(
      `cleanup-orphaned-notifications: soft-deleted ${orphanedComments} comment(s) ` +
        `stranded under deleted content and retired ${retiredUnread} reply plus ` +
        `${retiredActionUpdateUnread} action-update unread row(s); ` +
        `removed ${commentLinked} comment-linked, ${commentLikes} comment-like, ` +
        `${postLikes} post-like and ${activityLikes} activity-like notification(s) ` +
        `whose target no longer resolves`,
    );
  }

  public async down(): Promise<void> {
    // Deleted notifications cannot be reconstructed, and restoring comments
    // whose parents no longer exist would leave them unreachable.
  }
}
