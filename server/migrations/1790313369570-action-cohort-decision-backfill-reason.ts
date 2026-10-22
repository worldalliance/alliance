import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionCohortDecisionBackfillReason1790313369570 implements MigrationInterface {
    name = 'ActionCohortDecisionBackfillReason1790313369570'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_reason_enum" ADD VALUE 'backfill'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "action_cohort_decision" WHERE "reason" = 'backfill'`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" DROP CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded"`);
        await queryRunner.query(`CREATE TYPE "public"."action_cohort_decision_reason_enum_old" AS ENUM('launch', 'signing', 'resolved_after_deadline')`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ALTER COLUMN "reason" TYPE "public"."action_cohort_decision_reason_enum_old" USING "reason"::"text"::"public"."action_cohort_decision_reason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."action_cohort_decision_reason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_reason_enum_old" RENAME TO "action_cohort_decision_reason_enum"`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ADD CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded" CHECK ("reason" <> 'resolved_after_deadline' OR NOT "included")`);
    }

}
