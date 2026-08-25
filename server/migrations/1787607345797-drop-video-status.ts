import { MigrationInterface, QueryRunner } from "typeorm";

export class DropVideoStatus1787607345797 implements MigrationInterface {
    name = 'DropVideoStatus1787607345797'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "status"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "video" ADD "status" character varying NOT NULL DEFAULT 'processing'`);
    }

}
