import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveActionUpdateRecognitionExperiment1792099832709 implements MigrationInterface {
    name = 'RemoveActionUpdateRecognitionExperiment1792099832709'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_update_exposure" DROP COLUMN "assignedArm"`);
        await queryRunner.query(`DELETE FROM "experiment_assignment" WHERE "experiment" = 'action_update_recognition'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment" RENAME TO "Experiment_old"`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment" AS ENUM('missed_suite_first_notice', 'reminder_social_proof', 'contract_reminder')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment" USING "experiment"::"text"::"public"."Experiment"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_97dd17c6d2b23adc4aaaf2a222"`);
        await queryRunner.query(`CREATE TYPE "public"."Experiment_old" AS ENUM('missed_suite_first_notice', 'action_update_recognition', 'reminder_social_proof', 'contract_reminder')`);
        await queryRunner.query(`ALTER TABLE "experiment_assignment" ALTER COLUMN "experiment" TYPE "public"."Experiment_old" USING "experiment"::"text"::"public"."Experiment_old"`);
        await queryRunner.query(`DROP TYPE "public"."Experiment"`);
        await queryRunner.query(`ALTER TYPE "public"."Experiment_old" RENAME TO "Experiment"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97dd17c6d2b23adc4aaaf2a222" ON "experiment_assignment" ("userId", "experiment") `);
        await queryRunner.query(`ALTER TABLE "action_update_exposure" ADD "assignedArm" "public"."ExperimentArm"`);
    }

}
