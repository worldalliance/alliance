import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionPrerequisites1790353957840 implements MigrationInterface {
    name = 'ActionPrerequisites1790353957840'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "prerequisiteActionIds" integer array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_correction_previousreason_enum" ADD VALUE 'prerequisites_resolved'`);
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_reason_enum" ADD VALUE 'prerequisites_resolved'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "action_cohort_decision" WHERE "reason" = 'prerequisites_resolved' OR "id" IN (SELECT "decisionId" FROM "action_cohort_decision_correction" WHERE "previousReason" = 'prerequisites_resolved')`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" DROP CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded"`);
        await queryRunner.query(`CREATE TYPE "public"."action_cohort_decision_reason_enum_old" AS ENUM('launch', 'signing', 'resolved_after_deadline', 'backfill', 'staff_correction')`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ALTER COLUMN "reason" TYPE "public"."action_cohort_decision_reason_enum_old" USING "reason"::"text"::"public"."action_cohort_decision_reason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."action_cohort_decision_reason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_reason_enum_old" RENAME TO "action_cohort_decision_reason_enum"`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ADD CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded" CHECK ("reason" <> 'resolved_after_deadline' OR NOT "included")`);
        await queryRunner.query(`CREATE TYPE "public"."action_cohort_decision_correction_previousreason_enum_old" AS ENUM('launch', 'signing', 'resolved_after_deadline', 'backfill', 'staff_correction')`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision_correction" ALTER COLUMN "previousReason" TYPE "public"."action_cohort_decision_correction_previousreason_enum_old" USING "previousReason"::"text"::"public"."action_cohort_decision_correction_previousreason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."action_cohort_decision_correction_previousreason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_correction_previousreason_enum_old" RENAME TO "action_cohort_decision_correction_previousreason_enum"`);
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "prerequisiteActionIds"`);
    }

}
