import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraBatchDropExportSchema1794524099756 implements MigrationInterface {
    name = 'KoraBatchDropExportSchema1794524099756'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_batch" DROP COLUMN "exportSchema"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_batch" ADD "exportSchema" jsonb NOT NULL`);
    }

}
