import { MigrationInterface, QueryRunner } from "typeorm";

export class FormRiskLevel1782419179200 implements MigrationInterface {
    name = 'FormRiskLevel1782419179200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form" ADD "riskLevel" text NOT NULL DEFAULT 'low'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form" DROP COLUMN "riskLevel"`);
    }

}
