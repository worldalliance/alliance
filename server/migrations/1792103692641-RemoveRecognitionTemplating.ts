import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveRecognitionTemplating1792103692641 implements MigrationInterface {
    name = 'RemoveRecognitionTemplating1792103692641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "contributionFormula"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "retrospectiveContributionFormula"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "mode"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "branch"`);
        await queryRunner.query(`DROP TYPE "public"."RecognitionBranch"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "weeksAgo"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "contribution"`);
        await queryRunner.query(`UPDATE "action_update" SET "notificationMode" = 'normal' WHERE "notificationMode" = 'retrospective'`);
        await queryRunner.query(`ALTER TYPE "public"."ActionUpdateNotificationMode" RENAME TO "ActionUpdateNotificationMode_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ActionUpdateNotificationMode" AS ENUM('legacy', 'normal')`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "notificationMode" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "notificationMode" TYPE "public"."ActionUpdateNotificationMode" USING "notificationMode"::"text"::"public"."ActionUpdateNotificationMode"`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "notificationMode" SET DEFAULT 'legacy'`);
        await queryRunner.query(`DROP TYPE "public"."ActionUpdateNotificationMode_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ActionUpdateNotificationMode_old" AS ENUM('legacy', 'normal', 'retrospective')`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "notificationMode" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "notificationMode" TYPE "public"."ActionUpdateNotificationMode_old" USING "notificationMode"::"text"::"public"."ActionUpdateNotificationMode_old"`);
        await queryRunner.query(`ALTER TABLE "action_update" ALTER COLUMN "notificationMode" SET DEFAULT 'legacy'`);
        await queryRunner.query(`DROP TYPE "public"."ActionUpdateNotificationMode"`);
        await queryRunner.query(`ALTER TYPE "public"."ActionUpdateNotificationMode_old" RENAME TO "ActionUpdateNotificationMode"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "contribution" text`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "weeksAgo" integer`);
        await queryRunner.query(`CREATE TYPE "public"."RecognitionBranch" AS ENUM('a', 'b')`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "branch" "public"."RecognitionBranch"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "mode" "public"."ActionUpdateNotificationMode"`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "retrospectiveContributionFormula" jsonb`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "contributionFormula" jsonb`);
    }

}
