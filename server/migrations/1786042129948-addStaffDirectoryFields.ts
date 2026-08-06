import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaffDirectoryFields1786042129948 implements MigrationInterface {
    name = 'AddStaffDirectoryFields1786042129948'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "staffTitle" character varying`);
        await queryRunner.query(`ALTER TABLE "user" ADD "staffDisplayOrder" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "staffDisplayOrder"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "staffTitle"`);
    }

}
