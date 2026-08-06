import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaffLink1786043176263 implements MigrationInterface {
    name = 'AddStaffLink1786043176263'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "staffLink" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "staffLink"`);
    }

}
