import { MigrationInterface, QueryRunner } from "typeorm";

export class KoraClosesAt1794595448213 implements MigrationInterface {
    name = 'KoraClosesAt1794595448213'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_batch" ADD "closesAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "kora_assignment" ADD "closesAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kora_assignment" DROP COLUMN "closesAt"`);
        await queryRunner.query(`ALTER TABLE "kora_batch" DROP COLUMN "closesAt"`);
    }

}
