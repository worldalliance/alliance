import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalizeLikeNotificationGroupingKeys1785540926619 implements MigrationInterface {
  name = 'CanonicalizeLikeNotificationGroupingKeys1785540926619';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         'like:post:' || split_part(n."groupingKey", ':', 3)
       WHERE n."category" = 'likes'
         AND (
           n."groupingKey" ~ '^forum_like:post:[0-9]+$'
           OR n."groupingKey" ~ '^forum_like:post:[0-9]+:user:[0-9]+$'
         )`,
    );

    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         'like:comment:' || split_part(n."groupingKey", ':', 3)
       WHERE n."category" = 'likes'
         AND n."groupingKey" ~ '^forum_like:comment:[0-9]+$'`,
    );

    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         'like:activity:' || activity."type"::text || ':' || activity."id"
       FROM "action_activity" activity
       WHERE n."category" = 'likes'
         AND n."groupingKey" ~ '^activity_like:[0-9]+$'
         AND activity."id" = split_part(n."groupingKey", ':', 2)::numeric`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         'forum_like:post:' || split_part(n."groupingKey", ':', 3) ||
         ':user:' || n."userId"
       WHERE n."category" = 'likes'
         AND n."groupingKey" ~ '^like:post:[0-9]+$'
         AND n."userId" IS NOT NULL`,
    );

    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         'forum_like:comment:' || split_part(n."groupingKey", ':', 3)
       WHERE n."category" = 'likes'
         AND n."groupingKey" ~ '^like:comment:[0-9]+$'`,
    );

    await queryRunner.query(
      `UPDATE "notification" n
       SET "groupingKey" =
         'activity_like:' || split_part(n."groupingKey", ':', 4)
       WHERE n."category" = 'likes'
         AND n."groupingKey" ~
           '^like:activity:[a-z0-9_]+:[0-9]+$'`,
    );
  }
}
