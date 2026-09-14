import { MigrationInterface, QueryRunner } from "typeorm";

export class ActionStaffPreview1789418641611 implements MigrationInterface {
    name = 'ActionStaffPreview1789418641611'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" ADD "staffPreview" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "action" DROP COLUMN "staffPreview"`);
    }

}
