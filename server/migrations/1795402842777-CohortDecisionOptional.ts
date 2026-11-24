import { MigrationInterface, QueryRunner } from "typeorm";

export class CohortDecisionOptional1795402842777 implements MigrationInterface {
    name = 'CohortDecisionOptional1795402842777'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" ADD "optional" boolean`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_cohort_decision" DROP COLUMN "optional"`);
    }

}
