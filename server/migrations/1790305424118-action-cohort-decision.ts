import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionCohortDecision1790305424118 implements MigrationInterface {
    name = 'ActionCohortDecision1790305424118'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."action_cohort_decision_reason_enum" AS ENUM('launch', 'signing', 'resolved_after_deadline')`);
        await queryRunner.query(`CREATE TABLE "action_cohort_decision" ("id" SERIAL NOT NULL, "actionId" integer NOT NULL, "userId" integer NOT NULL, "included" boolean NOT NULL, "reason" "public"."action_cohort_decision_reason_enum" NOT NULL, "resolvedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_action_cohort_decision_actionId_userId" UNIQUE ("actionId", "userId"), CONSTRAINT "CHK_action_cohort_decision_after_deadline_excluded" CHECK ("reason" <> 'resolved_after_deadline' OR NOT "included"), CONSTRAINT "PK_d062eeaeffd4cd48f896ab07a35" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_action_cohort_decision_userId" ON "action_cohort_decision" ("userId") `);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ADD CONSTRAINT "FK_1302961d583728cc81136badcc9" FOREIGN KEY ("actionId") REFERENCES "action"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ADD CONSTRAINT "FK_36a95fc340cd87c486be9aa00a9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" DROP CONSTRAINT "FK_36a95fc340cd87c486be9aa00a9"`);
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" DROP CONSTRAINT "FK_1302961d583728cc81136badcc9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_action_cohort_decision_userId"`);
        await queryRunner.query(`DROP TABLE "action_cohort_decision"`);
        await queryRunner.query(`DROP TYPE "public"."action_cohort_decision_reason_enum"`);
    }

}
