import { MigrationInterface, QueryRunner } from "typeorm";

export class StaffPreview1788289933042 implements MigrationInterface {
    name = 'StaffPreview1788289933042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "staffPreview" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "staffPreview"`);
    }

}
