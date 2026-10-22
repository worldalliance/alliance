import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveStreakRecognition1791471025174 implements MigrationInterface {
    name = 'RemoveStreakRecognition1791471025174'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fails outside a transaction, and holds off writers between the usage check and the drops.
        await queryRunner.query(`LOCK TABLE "reminder_group", "experiment_assignment", "action_event_notif" IN ACCESS EXCLUSIVE MODE`);
        const [usage]: { enabledReminderGroups: number; streakAssignments: number; streakNotifs: number }[] = await queryRunner.query(
            `SELECT
                (SELECT count(*) FROM "reminder_group" WHERE "streakRecognition")::int AS "enabledReminderGroups",
                (SELECT count(*) FROM "experiment_assignment" WHERE "experiment" = 'streak_recognition')::int AS "streakAssignments",
                (SELECT count(*) FROM "action_event_notif"
                    WHERE "streakCount" IS NOT NULL OR "streakRunSuiteId" IS NOT NULL OR "streakRecognitionCopy" IS NOT NULL)::int AS "streakNotifs"`,
        );
        if (usage.enabledReminderGroups > 0 || usage.streakAssignments > 0 || usage.streakNotifs > 0) {
            throw new Error(
                `Streak recognition is still in use, so its removal is paused until someone decides what happens to: ` +
                `${usage.enabledReminderGroups} reminder group(s) with streakRecognition on, ` +
                `${usage.streakAssignments} streak_recognition experiment assignment(s), ` +
                `${usage.streakNotifs} action_event_notif row(s) with streak values`,
            );
        }

        await queryRunner.query(`DROP INDEX "public"."IDX_be75e72540f89ecdd0a7d225ef"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "streakRecognition"`);
        await queryRunner.query(`ALTER TABLE "action_suite" DROP COLUMN "onboarding"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "streakCount"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "streakRunSuiteId"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "streakRecognitionCopy"`);
        await queryRunner.query(`DROP TYPE "public"."StreakRecognitionCopy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment" RENAME TO "Experiment_old"`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment" AS ENUM('missed_suite_first_notice', 'action_update_recognition')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment" USING "experiment"::"text"::"public"."Experiment"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment" RENAME TO "Experiment_old"`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment" AS ENUM('missed_suite_first_notice', 'action_update_recognition', 'streak_recognition')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment" USING "experiment"::"text"::"public"."Experiment"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
        await queryRunner.query(`CREATE TYPE "public"."StreakRecognitionCopy" AS ENUM('control', 'recognition_v1')`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "streakRecognitionCopy" "public"."StreakRecognitionCopy"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "streakRunSuiteId" integer`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "streakCount" integer`);
        await queryRunner.query(`ALTER TABLE "action_suite" ADD "onboarding" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`UPDATE "action_suite" SET "onboarding" = true WHERE "name" = 'Onboarding'`);
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "streakRecognition" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_be75e72540f89ecdd0a7d225ef" ON "action_event_notif" ("userId", "streakRunSuiteId", "streakCount") WHERE "streakRunSuiteId" IS NOT NULL`);
    }

}
