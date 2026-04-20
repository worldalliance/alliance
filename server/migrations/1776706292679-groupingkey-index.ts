import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupingkeyIndex1776706292679 implements MigrationInterface {
  name = 'GroupingkeyIndex1776706292679';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_user_groupingKey_category" ON "notification" ("userId", "groupingKey", "category") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_user_groupingKey_category"`,
    );
  }
}
