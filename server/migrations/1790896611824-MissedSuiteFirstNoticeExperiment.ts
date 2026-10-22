import { MigrationInterface, QueryRunner } from "typeorm";

export class MissedSuiteFirstNoticeExperiment1790896611824 implements MigrationInterface {
    name = 'MissedSuiteFirstNoticeExperiment1790896611824'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."Experiment" AS ENUM('missed_suite_first_notice')`);
        await queryRunner.query(`CREATE TYPE "public"."ExperimentArm" AS ENUM('control', 'variant')`);
        await queryRunner.query(`CREATE TABLE "experiment_assignment" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "experiment" "public"."Experiment" NOT NULL, "arm" "public"."ExperimentArm" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_01f8d1b7fa165c43aada3b5fb5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
        await queryRunner.query(`ALTER TYPE "public"."MissedSuiteNoticeCopy" RENAME TO "MissedSuiteNoticeCopy_old"`);
        await queryRunner.query(`CREATE TYPE "public"."MissedSuiteNoticeCopy" AS ENUM('first_miss_control', 'first_miss_report_v1', 'second_miss_report_v1')`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ALTER COLUMN "missedSuiteCopy" TYPE "public"."MissedSuiteNoticeCopy" USING "missedSuiteCopy"::"text"::"public"."MissedSuiteNoticeCopy"`);
        await queryRunner.query(`DROP TYPE "public"."MissedSuiteNoticeCopy_old"`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ADD CONSTRAINT "FK_ad2a38819ec5ee53ba1a9edd0d8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "experiment_assignment" DROP CONSTRAINT "FK_ad2a38819ec5ee53ba1a9edd0d8"`);
        await queryRunner.query(`CREATE TYPE "public"."MissedSuiteNoticeCopy_old" AS ENUM('first_miss_control', 'second_miss_report_v1')`);
        await queryRunner.query(`ALTER TABLE "action_event_notif" ALTER COLUMN "missedSuiteCopy" TYPE "public"."MissedSuiteNoticeCopy_old" USING "missedSuiteCopy"::"text"::"public"."MissedSuiteNoticeCopy_old"`);
        await queryRunner.query(`DROP TYPE "public"."MissedSuiteNoticeCopy"`);
        await queryRunner.query(`ALTER TYPE "public"."MissedSuiteNoticeCopy_old" RENAME TO "MissedSuiteNoticeCopy"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`DROP TABLE "experiment_assignment"`);
        await queryRunner.query(`DROP TYPE "public"."ExperimentArm"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment"`);
    }

}
