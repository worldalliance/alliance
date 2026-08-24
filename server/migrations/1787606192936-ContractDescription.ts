import { MigrationInterface, QueryRunner } from "typeorm";

export class ContractDescription1787606192936 implements MigrationInterface {
    name = 'ContractDescription1787606192936'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" ADD "description" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contract" DROP COLUMN "description"`);
    }

}
