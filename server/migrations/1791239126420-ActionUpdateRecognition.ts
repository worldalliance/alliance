import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionUpdateRecognition1791239126420 implements MigrationInterface {
    name = 'ActionUpdateRecognition1791239126420'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ActionUpdateNotificationMode" AS ENUM('legacy', 'normal', 'retrospective')`);
        await queryRunner.query(`CREATE TYPE "public"."RecognitionBranch" AS ENUM('a', 'b')`);
        await queryRunner.query(`CREATE TABLE "action_update_exposure" ("id" SERIAL NOT NULL, "actionUpdateId" integer NOT NULL, "userId" integer NOT NULL, "mode" "public"."ActionUpdateNotificationMode", "assignedArm" "public"."ExperimentArm", "completed" boolean, "branch" "public"."RecognitionBranch", "contribution" text, "weeksAgo" integer, "copy" jsonb, "cid" character varying, "preparedAt" TIMESTAMP WITH TIME ZONE, "unreadContentId" integer, "deliveryClaimedAt" TIMESTAMP WITH TIME ZONE, "deliveredAt" TIMESTAMP WITH TIME ZONE, "hiddenAt" TIMESTAMP WITH TIME ZONE, "emailFailedAt" TIMESTAMP WITH TIME ZONE, "textFailedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "mailId" integer, "mmsId" integer, CONSTRAINT "REL_9bf71e25ad5fe01f7be4af4725" UNIQUE ("unreadContentId"), CONSTRAINT "REL_933cb4e4ad6ecdcdab6f969dc7" UNIQUE ("mailId"), CONSTRAINT "REL_4e730c69c11dc83361bb1d2fea" UNIQUE ("mmsId"), CONSTRAINT "PK_80e45521ad480154e5f94f96237" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f7a9bf626365b6126f8c92a95c" ON "action_update_exposure" ("actionUpdateId", "userId") `);
        // Every update that exists now keeps the copy it was written for.
        await queryRunner.query(`ALTER TABLE "action_update" ADD "notificationMode" "public"."ActionUpdateNotificationMode" NOT NULL DEFAULT 'legacy'`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "contributionFormula" jsonb`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "retrospectiveContributionFormula" jsonb`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "recognitionPreparedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "action_update" ADD "notificationHeldReason" text`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment" RENAME TO "Experiment_old"`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment" AS ENUM('missed_suite_first_notice', 'action_update_recognition')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment" USING "experiment"::"text"::"public"."Experiment"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD CONSTRAINT "FK_ef9d30e789d7b47cf43f46788b6" FOREIGN KEY ("actionUpdateId") REFERENCES "action_update"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD CONSTRAINT "FK_baeffd7f469f14b863eaabff1ab" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD CONSTRAINT "FK_9bf71e25ad5fe01f7be4af47251" FOREIGN KEY ("unreadContentId") REFERENCES "unread_content"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD CONSTRAINT "FK_933cb4e4ad6ecdcdab6f969dc76" FOREIGN KEY ("mailId") REFERENCES "mail"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD CONSTRAINT "FK_4e730c69c11dc83361bb1d2feaa" FOREIGN KEY ("mmsId") REFERENCES "mms"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP CONSTRAINT "FK_4e730c69c11dc83361bb1d2feaa"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP CONSTRAINT "FK_933cb4e4ad6ecdcdab6f969dc76"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP CONSTRAINT "FK_9bf71e25ad5fe01f7be4af47251"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP CONSTRAINT "FK_baeffd7f469f14b863eaabff1ab"`);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP CONSTRAINT "FK_ef9d30e789d7b47cf43f46788b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`DELETE FROM "experiment_assignment" WHERE "experiment" = 'action_update_recognition'`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment_old" AS ENUM('missed_suite_first_notice')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment_old" USING "experiment"::"text"::"public"."Experiment_old"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment_old" RENAME TO "Experiment"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "notificationHeldReason"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "recognitionPreparedAt"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "retrospectiveContributionFormula"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "contributionFormula"`);
        await queryRunner.query(`ALTER TABLE "action_update" DROP COLUMN "notificationMode"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7a9bf626365b6126f8c92a95c"`);
        await queryRunner.query(`DROP TABLE "action_update_exposure"`);
        await queryRunner.query(`DROP TYPE "public"."RecognitionBranch"`);
        await queryRunner.query(`DROP TYPE "public"."ActionUpdateNotificationMode"`);
    }

}
