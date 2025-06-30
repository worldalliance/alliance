import { MigrationInterface, QueryRunner } from 'typeorm';

export class MoreActionStates1751312972243 implements MigrationInterface {
  name = 'MoreActionStates1751312972243';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            UPDATE "action"
            SET "status" = 'draft'
            WHERE "status" = 'active'
        `);
    await queryRunner.query(`
            UPDATE "action"
            SET "status" = 'draft'
            WHERE "status" = 'past'
        `);

    await queryRunner.query(
      `ALTER TYPE "public"."action_status_enum" RENAME TO "action_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."action_status_enum" AS ENUM('draft', 'upcoming', 'gathering-commitments', 'commitments-reached', 'member-action', 'resolution', 'completed', 'failed', 'abandoned')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "status" TYPE "public"."action_status_enum" USING "status"::"text"::"public"."action_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(`DROP TYPE "public"."action_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."action_status_enum_old" AS ENUM('active', 'upcoming', 'past', 'draft')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "status" TYPE "public"."action_status_enum_old" USING "status"::"text"::"public"."action_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(`DROP TYPE "public"."action_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."action_status_enum_old" RENAME TO "action_status_enum"`,
    );
  }
}
