import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillLikes1764970323201 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        UPDATE "action_activity" aa
        SET "likesCount" = COALESCE(lc."likeCount", 0)
        FROM (
          SELECT "actionActivityId" AS "actionActivityId",
                 COUNT(*)::integer AS "likeCount"
          FROM "action_activity_likes_user"
          GROUP BY "actionActivityId"
        ) lc
        WHERE lc."actionActivityId" = aa.id
      `);
  }

  public async down(): Promise<void> {}
}
