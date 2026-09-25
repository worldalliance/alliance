import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionCohortDecisionCorrection1790345195237 implements MigrationInterface {
    name = 'ActionCohortDecisionCorrection1790345195237'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_reason_enum" ADD VALUE 'staff_correction'`);
        await queryRunner.query(`CREATE TYPE "public"."action_cohort_decision_correction_previousreason_enum" AS ENUM('launch', 'signing', 'resolved_after_deadline', 'backfill', 'staff_correction')`);
        await queryRunner.query(`CREATE TABLE "action_cohort_decision_correction" ("id" SERIAL NOT NULL, "decisionId" integer NOT NULL, "previousIncluded" boolean NOT NULL, "previousReason" "public"."action_cohort_decision_correction_previousreason_enum" NOT NULL, "previousResolvedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "note" text NOT NULL, "correctedById" integer, "correctedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9f72ef917000c2b8eaa322d6cb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_action_cohort_decision_correction_decisionId" ON "action_cohort_decision_correction" ("decisionId") `);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision_correction" ADD CONSTRAINT "FK_d81db006aae41c624695e17d1a0" FOREIGN KEY ("decisionId") REFERENCES "action_cohort_decision"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision_correction" ADD CONSTRAINT "FK_a9476de1ec256696fe209d160a1" FOREIGN KEY ("correctedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_cohort_decision_correction" DROP CONSTRAINT "FK_a9476de1ec256696fe209d160a1"`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision_correction" DROP CONSTRAINT "FK_d81db006aae41c624695e17d1a0"`);
        await queryRunner.query(`UPDATE "action_cohort_decision" d SET "included" = c."previousIncluded", "reason" = c."previousReason"::text::"public"."action_cohort_decision_reason_enum", "resolvedAt" = c."previousResolvedAt" FROM (SELECT DISTINCT ON ("decisionId") * FROM "action_cohort_decision_correction" ORDER BY "decisionId", "correctedAt") c WHERE d."id" = c."decisionId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_cohort_decision_correction_decisionId"`);
        await queryRunner.query(`DROP TABLE "action_cohort_decision_correction"`);
        await queryRunner.query(`DROP TYPE "public"."action_cohort_decision_correction_previousreason_enum"`);
        await queryRunner.query(`DELETE FROM "action_cohort_decision" WHERE "reason" = 'staff_correction'`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" DROP CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded"`);
        await queryRunner.query(`CREATE TYPE "public"."action_cohort_decision_reason_enum_old" AS ENUM('launch', 'signing', 'resolved_after_deadline', 'backfill')`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ALTER COLUMN "reason" TYPE "public"."action_cohort_decision_reason_enum_old" USING "reason"::"text"::"public"."action_cohort_decision_reason_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."action_cohort_decision_reason_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."action_cohort_decision_reason_enum_old" RENAME TO "action_cohort_decision_reason_enum"`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ADD CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded" CHECK ("reason" <> 'resolved_after_deadline' OR NOT "included")`);
    }

}
