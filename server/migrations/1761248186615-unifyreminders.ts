import { MigrationInterface, QueryRunner } from 'typeorm';

export class Unifyreminders1761086336738 implements MigrationInterface {
  name = 'Unifyreminders1761086336738';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP CONSTRAINT "FK_4ee0d898ad963a8ad5c10d2c5f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "deadlineEventId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event" DROP COLUMN "threeDayReminderNotifsSentAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event" DROP COLUMN "oneDayReminderNotifsSentAt"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."action_reminder_cohorttype_enum" AS ENUM('all_uncompleted', 'custom')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "cohortType" "public"."action_reminder_cohorttype_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."action_reminder_timingmode_enum" AS ENUM('absolute', 'from_deadline')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "timingMode" "public"."action_reminder_timingmode_enum" NOT NULL DEFAULT 'absolute'`,
    );

    await queryRunner.query(
      `ALTER TABLE "action_reminder" RENAME COLUMN "customEmailSubject" TO "emailSubject"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "emailSubject" SET DEFAULT 'Action Reminder'`,
    );
    await queryRunner.query(`
            UPDATE "action_reminder"
            SET "emailSubject" = 'Action Reminder'
            WHERE "emailSubject" IS NULL OR "emailSubject" = ''
          `);
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "emailSubject" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "sendAtSecondsFromDeadline" integer`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."ActionEventNotifType" RENAME TO "ActionEventNotifType_old"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."ActionEventNotifType" AS ENUM('announcement', 'misseddeadline', 'reminder')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event_notif" ALTER COLUMN "type" DROP DEFAULT`,
    );

    await queryRunner.query(`
            ALTER TABLE "action_event_notif"
            ALTER COLUMN "type" TYPE text USING "type"::text
          `);

    // 3) Normalize old values to the new label
    await queryRunner.query(`
            UPDATE "action_event_notif"
            SET "type" = 'reminder'
            WHERE "type" IN ('3dayreminder','1dayreminder','customreminder')
          `);

    await queryRunner.query(
      `ALTER TABLE "action_event_notif" ALTER COLUMN "type" TYPE "public"."ActionEventNotifType" USING "type"::"text"::"public"."ActionEventNotifType"`,
    );

    await queryRunner.query(
      `ALTER TABLE "action_event_notif" ALTER COLUMN "type" SET DEFAULT 'announcement'`,
    );
    await queryRunner.query(`DROP TYPE "public"."ActionEventNotifType_old"`);
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "includeActionLinkInMessages" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "action_reminder" RENAME COLUMN "sendAt" TO "sendAtAbsolute"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" RENAME COLUMN "customTextMessage" TO "textMessage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" RENAME COLUMN "customEmailMessage" TO "emailMessage"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ALTER COLUMN "includeActionLinkInMessages" SET DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ActionEventNotifType_old" AS ENUM('announcement', '3dayreminder', '1dayreminder', 'misseddeadline', 'customreminder')`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event_notif" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event_notif" ALTER COLUMN "type" TYPE "public"."ActionEventNotifType_old" USING "type"::"text"::"public"."ActionEventNotifType_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event_notif" ALTER COLUMN "type" SET DEFAULT 'announcement'`,
    );
    await queryRunner.query(`DROP TYPE "public"."ActionEventNotifType"`);
    await queryRunner.query(
      `ALTER TYPE "public"."ActionEventNotifType_old" RENAME TO "ActionEventNotifType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "sendAtSecondsFromDeadline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "sendAtAbsolute"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "textMessage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "emailSubject"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "emailMessage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "timingMode"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."action_reminder_timingmode_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" DROP COLUMN "cohortType"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."action_reminder_cohorttype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event" ADD "oneDayReminderNotifsSentAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_event" ADD "threeDayReminderNotifsSentAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "customEmailMessage" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "customTextMessage" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "deadlineEventId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD "sendAt" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "action_reminder" ADD CONSTRAINT "FK_4ee0d898ad963a8ad5c10d2c5f4" FOREIGN KEY ("deadlineEventId") REFERENCES "action_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
