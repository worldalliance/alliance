import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActionActivityTypeEnum1751325266207 implements MigrationInterface {
  name = 'ActionActivityTypeEnum1751325266207';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the enum
    await queryRunner.query(`
      CREATE TYPE "public"."action_activity_type_enum"
      AS ENUM ('user_joined', 'user_completed')
    `);

    // 2. Temporarily rename the old column so we can copy from it
    await queryRunner.query(`
      ALTER TABLE "action_activity"
      RENAME COLUMN "type" TO "type_old"
    `);

    // 3. Add the new column **nullable** for now
    await queryRunner.query(`
      ALTER TABLE "action_activity"
      ADD COLUMN "type" "public"."action_activity_type_enum"
    `);

    // 4. Copy/translate the data
    //    If the old values already match the new enum labels, this is trivial:
    await queryRunner.query(`
      UPDATE "action_activity"
      SET "type" = "type_old"::text::"public"."action_activity_type_enum"
    `);

    // 5. Enforce NOT NULL once every row is populated
    await queryRunner.query(`
      ALTER TABLE "action_activity"
      ALTER COLUMN "type" SET NOT NULL
    `);

    // 6. Drop the old column
    await queryRunner.query(`
      ALTER TABLE "action_activity" DROP COLUMN "type_old"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the steps, using a varchar fallback
    await queryRunner.query(`
      ALTER TABLE "action_activity"
      ADD COLUMN "type_old" character varying
    `);

    await queryRunner.query(`
      UPDATE "action_activity"
      SET "type_old" = "type"::text
    `);

    await queryRunner.query(`
      ALTER TABLE "action_activity"
      DROP COLUMN "type"
    `);

    await queryRunner.query(`
      ALTER TABLE "action_activity"
      RENAME COLUMN "type_old" TO "type"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."action_activity_type_enum"
    `);
  }
}
