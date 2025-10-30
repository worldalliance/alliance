import { MigrationInterface, QueryRunner } from "typeorm";

export class Newremindergroups1761847346939 implements MigrationInterface {
    name = 'Newremindergroups1761847346939'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_c92d52f3d1156922555a5d80b41"`);
        await queryRunner.query(`CREATE TABLE "action_suite" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_051c30af2740df553849334cf46" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reminder_group_users" ("reminderGroupId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_ac0adf27ce5069d59558804249b" PRIMARY KEY ("reminderGroupId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0a3786b421b95d8710e050c250" ON "reminder_group_users" ("reminderGroupId") `);
        await queryRunner.query(`CREATE INDEX "IDX_48c3e4213a219da599ea512cff" ON "reminder_group_users" ("userId") `);
        await queryRunner.query(`ALTER TABLE "action_event" DROP COLUMN "deadlineNotifsSentAt"`);
        await queryRunner.query(`ALTER TABLE "action_event" DROP COLUMN "announcementNotifsSentAt"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "actionEventId"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "sendDay"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "idempotency_key" text`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "reminderGroupId" integer`);
        await queryRunner.query(`CREATE TYPE "public"."reminder_group_timingmode_enum" AS ENUM('absolute', 'from_deadline', 'within_range', 'event_launch')`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "timingMode" "public"."reminder_group_timingmode_enum" NOT NULL DEFAULT 'within_range'`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "send_range_start" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "send_range_end" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "sendAtAbsolute" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "sendAtSecondsFromDeadline" integer`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "allSent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "actionSuiteId" integer`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "deadlineEventId" integer`);
        await queryRunner.query(`ALTER TABLE "action" ADD "suiteId" integer`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ead0e1d265ff04fe467343be56" ON "action_event_notif" ("idempotency_key") WHERE idempotency_key IS NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "CHK_9b31a4f7019205096c6cdf8a69" CHECK (send_range_start IS NULL OR send_range_end IS NULL OR send_range_start <= send_range_end)`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "CHK_7c15e87a365e5968509fed8385" CHECK (("timingMode" = 'absolute' AND "sendAtAbsolute" IS NOT NULL)
     OR ("timingMode" = 'from_deadline' AND "sendAtSecondsFromDeadline" IS NOT NULL)
     OR ("timingMode" = 'within_range' AND "send_range_start" IS NOT NULL AND "send_range_end" IS NOT NULL)
     OR ("timingMode" = 'event_launch' AND "memberActionEventId" IS NOT NULL))`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_a4aa7f8a48a1580f89e5b9f4434" FOREIGN KEY ("reminderGroupId") REFERENCES "reminder_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "FK_d1c7c429a93421ddcabf29da31f" FOREIGN KEY ("actionSuiteId") REFERENCES "action_suite"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD CONSTRAINT "FK_ebb602a83fdb0710084455ec2bf" FOREIGN KEY ("deadlineEventId") REFERENCES "action_event"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action" ADD CONSTRAINT "FK_8455eea77529f7b542576b3e77e" FOREIGN KEY ("suiteId") REFERENCES "action_suite"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reminder_group_users" ADD CONSTRAINT "FK_0a3786b421b95d8710e050c2505" FOREIGN KEY ("reminderGroupId") REFERENCES "reminder_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "reminder_group_users" ADD CONSTRAINT "FK_48c3e4213a219da599ea512cfff" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group_users" DROP CONSTRAINT "FK_48c3e4213a219da599ea512cfff"`);
        await queryRunner.query(`ALTER TABLE "reminder_group_users" DROP CONSTRAINT "FK_0a3786b421b95d8710e050c2505"`);
        await queryRunner.query(`ALTER TABLE "action" DROP CONSTRAINT "FK_8455eea77529f7b542576b3e77e"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "FK_ebb602a83fdb0710084455ec2bf"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "FK_d1c7c429a93421ddcabf29da31f"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP CONSTRAINT "FK_a4aa7f8a48a1580f89e5b9f4434"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "CHK_7c15e87a365e5968509fed8385"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP CONSTRAINT "CHK_9b31a4f7019205096c6cdf8a69"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ead0e1d265ff04fe467343be56"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "suiteId"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "deadlineEventId"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "actionSuiteId"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "allSent"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "sendAtSecondsFromDeadline"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "sendAtAbsolute"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "send_range_end"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "send_range_start"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "timingMode"`);
        await queryRunner.query(`DROP TYPE "public"."reminder_group_timingmode_enum"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "reminderGroupId"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "idempotency_key"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "sendDay" date NOT NULL`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "actionEventId" integer`);
        await queryRunner.query(`ALTER TABLE "action_event" ADD "announcementNotifsSentAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "action_event" ADD "deadlineNotifsSentAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48c3e4213a219da599ea512cff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a3786b421b95d8710e050c250"`);
        await queryRunner.query(`DROP TABLE "reminder_group_users"`);
        await queryRunner.query(`DROP TABLE "action_suite"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD CONSTRAINT "FK_c92d52f3d1156922555a5d80b41" FOREIGN KEY ("actionEventId") REFERENCES "action_event"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
