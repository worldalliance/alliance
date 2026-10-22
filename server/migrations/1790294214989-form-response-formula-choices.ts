import { MigrationInterface, QueryRunner } from "typeorm";

export class FormResponseFormulaChoices1790294214989 implements MigrationInterface {
    name = 'FormResponseFormulaChoices1790294214989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" ADD "formulaChoices" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "formulaChoices"`);
    }

}
