import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActionidToFormresponse1776812066235 implements MigrationInterface {
    name = 'AddActionidToFormresponse1776812066235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" ADD "actionId" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "form_response" DROP COLUMN "actionId"`);
    }

}
