import { MigrationInterface, QueryRunner } from "typeorm";

export class SuiteCreateCols1761861895829 implements MigrationInterface {
    name = 'SuiteCreateCols1761861895829'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_suite" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "action_suite" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action_suite" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "action_suite" DROP COLUMN "createdAt"`);
    }

}
