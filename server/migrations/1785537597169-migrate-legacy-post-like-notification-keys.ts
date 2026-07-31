import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateLegacyPostLikeNotificationKeys1785537597169 implements MigrationInterface {
  name = 'MigrateLegacyPostLikeNotificationKeys1785537597169';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `WITH legacy AS MATERIALIZED (
         SELECT n."id", split_part(n."groupingKey", ':', 3)::numeric AS "postId"
         FROM "notification" n
         WHERE n."category" = 'likes'
           AND n."groupingKey" ~ '^forum_like:post:[0-9]+$'
       )
       DELETE FROM "notification" n USING legacy
       WHERE n."id" = legacy."id"
         AND NOT EXISTS (
           SELECT 1 FROM "post" p
           WHERE p."id" = legacy."postId" AND p."deleted" = false
         )`,
    );

    await queryRunner.query(
      `WITH pairs AS MATERIALIZED (
         SELECT legacy."id" AS "legacyId", current."id" AS "currentId"
         FROM "notification" legacy
         JOIN "post" p
           ON p."id" = split_part(legacy."groupingKey", ':', 3)::numeric
          AND p."deleted" = false
         JOIN LATERAL (
           SELECT candidate."id"
           FROM "notification" candidate
           WHERE candidate."category" = 'likes'
             AND candidate."userId" = legacy."userId"
             AND candidate."groupingKey" =
               'forum_like:post:' || p."id" || ':user:' || legacy."userId"
             AND candidate."readAt" IS NULL
           ORDER BY candidate."updatedAt" DESC, candidate."id" DESC
           LIMIT 1
         ) current ON true
         WHERE legacy."category" = 'likes'
           AND legacy."groupingKey" ~ '^forum_like:post:[0-9]+$'
           AND legacy."readAt" IS NULL
       )
       INSERT INTO "notification_associated_users" ("notificationId", "userId")
       SELECT pairs."currentId", associated."userId"
       FROM pairs
       JOIN "notification_associated_users" associated
         ON associated."notificationId" = pairs."legacyId"
       ON CONFLICT DO NOTHING`,
    );

    await queryRunner.query(
      `WITH pairs AS MATERIALIZED (
         SELECT
           legacy."id" AS "legacyId",
           current."id" AS "currentId",
           legacy."targetContent" AS "legacyTargetContent"
         FROM "notification" legacy
         JOIN "post" p
           ON p."id" = split_part(legacy."groupingKey", ':', 3)::numeric
          AND p."deleted" = false
         JOIN LATERAL (
           SELECT candidate."id"
           FROM "notification" candidate
           WHERE candidate."category" = 'likes'
             AND candidate."userId" = legacy."userId"
             AND candidate."groupingKey" =
               'forum_like:post:' || p."id" || ':user:' || legacy."userId"
             AND candidate."readAt" IS NULL
           ORDER BY candidate."updatedAt" DESC, candidate."id" DESC
           LIMIT 1
         ) current ON true
         WHERE legacy."category" = 'likes'
           AND legacy."groupingKey" ~ '^forum_like:post:[0-9]+$'
           AND legacy."readAt" IS NULL
       ), merged AS (
         SELECT
           pairs."currentId",
           MAX(pairs."legacyTargetContent") AS "legacyTargetContent",
           COUNT(DISTINCT associated."userId")::integer AS "groupingCount"
         FROM pairs
         JOIN "notification_associated_users" associated
           ON associated."notificationId" = pairs."currentId"
         GROUP BY pairs."currentId"
       )
       UPDATE "notification" current
       SET
         "targetContent" = COALESCE(
           current."targetContent",
           merged."legacyTargetContent"
         ),
         "groupingCount" = merged."groupingCount",
         "message" = CASE
           WHEN merged."groupingCount" > 1 THEN
             merged."groupingCount" || ' people liked your ' ||
             CASE
               WHEN COALESCE(
                 current."targetContent",
                 merged."legacyTargetContent"
               ) IS NULL THEN 'post'
               ELSE 'post: ' || COALESCE(
                 current."targetContent",
                 merged."legacyTargetContent"
               )
             END
           ELSE current."message"
         END
       FROM merged
       WHERE current."id" = merged."currentId"`,
    );

    await queryRunner.query(
      `DELETE FROM "notification" legacy
       WHERE legacy."category" = 'likes'
         AND legacy."groupingKey" ~ '^forum_like:post:[0-9]+$'
         AND legacy."readAt" IS NULL
         AND EXISTS (
           SELECT 1
           FROM "notification" current
           WHERE current."category" = 'likes'
             AND current."userId" = legacy."userId"
             AND current."groupingKey" =
               'forum_like:post:' ||
               split_part(legacy."groupingKey", ':', 3)::numeric ||
               ':user:' || legacy."userId"
             AND current."readAt" IS NULL
         )`,
    );

    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         n."groupingKey" || ':user:' || n."userId"
       WHERE n."category" = 'likes'
         AND n."groupingKey" ~ '^forum_like:post:[0-9]+$'
         AND n."userId" IS NOT NULL`,
    );
  }

  public async down(): Promise<void> {}
}
