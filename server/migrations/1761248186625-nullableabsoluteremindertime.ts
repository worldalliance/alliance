import { MigrationInterface, QueryRunner } from 'typeorm';

export class Nullableabsoluteremindertime1761089998345
  implements MigrationInterface
{
  name = 'Nullableabsoluteremindertime1761089998345';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "timingMode" DROP DEFAULT`,
    );
    await queryRunner.query(`
            UPDATE "action_reminder"
            SET "emailMessage" = 'no message'
            WHERE "emailMessage" IS NULL OR "emailMessage" = ''
          `);
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "emailMessage" SET NOT NULL`,
    );
    await queryRunner.query(`
        UPDATE "action_reminder"
        SET "textMessage" = 'no message'
        WHERE "textMessage" IS NULL OR "textMessage" = ''
      `);

    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "emailSubject" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "textMessage" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "sendAtAbsolute" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "sendAtAbsolute" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "textMessage" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "emailSubject" SET DEFAULT 'Action Reminder'`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "emailMessage" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "timingMode" SET DEFAULT 'absolute'`,
    );
  }
}
