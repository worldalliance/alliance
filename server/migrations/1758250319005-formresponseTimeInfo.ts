import { MigrationInterface, QueryRunner } from "typeorm";

export class FormresponseTimeInfo1758250319005 implements MigrationInterface {
    name = 'FormresponseTimeInfo1758250319005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "createdAt"`);
    }

}
