import { MigrationInterface, QueryRunner } from "typeorm";

export class StreakRecognition1791324775327 implements MigrationInterface {
    name = 'StreakRecognition1791324775327'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reminder_group" ADD "streakRecognition" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "action_suite" ADD "onboarding" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`UPDATE "action_suite" SET "onboarding" = true WHERE "name" = 'Onboarding'`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "streakCount" integer`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "streakRunSuiteId" integer`);
        await queryRunner.query(`CREATE TYPE "public"."StreakRecognitionCopy" AS ENUM('control', 'recognition_v1')`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ADD "streakRecognitionCopy" "public"."StreakRecognitionCopy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment" RENAME TO "Experiment_old"`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment" AS ENUM('missed_suite_first_notice', 'action_update_recognition', 'streak_recognition')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment" USING "experiment"::"text"::"public"."Experiment"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_be75e72540f89ecdd0a7d225ef" ON "action_event_notif" ("userId", "streakRunSuiteId", "streakCount") WHERE "streakRunSuiteId" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_be75e72540f89ecdd0a7d225ef"`);
        await queryRunner.query(`DELETE FROM "experiment_assignment" WHERE "experiment" = 'streak_recognition'`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment_old" AS ENUM('missed_suite_first_notice', 'action_update_recognition')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment_old" USING "experiment"::"text"::"public"."Experiment_old"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment_old" RENAME TO "Experiment"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "streakRecognitionCopy"`);
        await queryRunner.query(`DROP TYPE "public"."StreakRecognitionCopy"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "streakRunSuiteId"`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" DROP COLUMN "streakCount"`);
        await queryRunner.query(`ALTER TABLE "action_suite" DROP COLUMN "onboarding"`);
        await queryRunner.query(`ALTER TABLE "reminder_group" DROP COLUMN "streakRecognition"`);
    }

}
